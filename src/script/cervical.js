import * as faceapi from "face-api.js";
import {getCameraList, loadCamera} from "./utils/camera";
import {drawPoint, loadCanvas} from "./utils/canvas";
import {getFrontUrl} from "./utils/config"
import * as posenet from '@tensorflow-models/posenet'
import * as math from 'mathjs'
import {euclidean} from "./utils/compareWithScore";


const guiState = {
    usePoseNet:true,
    canvas:{
        width:960,
        height:600,
        flipHorizontal:true,
    },
    webcam:{
        width:960,
        height:600
    },
    //当前分数
    mark:0,
    //蘑菇的框
    mushroom:null,
    boom:null,
    //降落速度
    detaY:7,
    faces:[]
}

/**
 * get min element from array
 * @returns {number}
 */
Array.prototype.min = function(){
    return Math.min.apply({},this)
}

/**
 * get max element from array
 * @returns {number}
 */
Array.prototype.max = function(){
    return Math.max.apply({},this)
}


/**
 * 创建mushroom/boom
 * @param x
 * @param y
 * @param w
 * @param h
 * @returns {Object}
 */
function createObject(x,y,w,h){
    let object=new Object
    object.x=x
    object.y=y
    object.w=w
    object.h=h
    return object
}

function createBoom(x,y,w,h) {
    let boom=new Object
    boom.x=x
    boom.y=y
    boom.w=w
    boom.h=h
    return boom
}

function ParamEllipse(context, x, y, a, b){
             //max是等于1除以长轴值a和b中的较大者
             //i每次循环增加1/max，表示度数的增加
             //这样可以使得每次循环所绘制的路径（弧线）接近1像素
    var step = (a > b) ? 1 / a : 1 / b;
             context.beginPath();
             context.moveTo(x + a, y); //从椭圆的左端点开始绘制
             for (var i = 0; i < 2 * Math.PI; i += step)
                 {
                //参数方程为x = a * cos(i), y = b * sin(i)，
                 //参数为i，表示度数（弧度）
                 context.lineTo(x + a * Math.cos(i), y + b * Math.sin(i));
                }
            context.closePath();
             context.stroke();
        }

/**
 * 判断face和mushroom/boom是否接触(点是否在框里面)
 * @param face 17个点的脸部边缘 point = {x ,y}
 * @param mushroom 蘑菇的框 [x,y,w,h] x,y左上角的点
 */
function isFaceTouchObject(face,ctx,object) {
    let flag=false
    const landmarks = face.landmarks
    // const jawOutline = landmarks.getJawOutline()

    let minX;
    let minY;
    let maxX;
    let maxY;
    let xList=[];
    let yList=[];
    landmarks.positions.forEach(({x,y})=>{
        xList.push(x)
        yList.push(y)
        // drawPoint(ctx, y, x, 2, 'aqua')
    })
    minX=xList.min()
    maxX=xList.max()
    minY=yList.min()
    maxY=yList.max()

    ctx.lineWidth=10
    ctx.strokeStyle="red"

    ParamEllipse(ctx,(maxX+minX)/2,(minY+maxY)/2,(maxX-minX)/2,(maxY-minY)/2)

    if(Math.pow(object.x+37.5-(maxX+minX)/2,2)/(Math.pow((maxX-minX)/2,2))+
        Math.pow(object.y+37.5-(maxY+minY)/2,2)/(Math.pow((maxY-minY)/2,2))<1){
        flag=true
        return true;
    }
    return flag
}

/**
 * 判断face和mushroom/boom是否接触(点是否在框里面)
 * @param face 17个点的脸部边缘 point = {x ,y}
 * @param mushroom 蘑菇的框 [x,y,w,h] x,y左上角的点
 */
function isFaceTouchObjectWithPoseNet(face,ctx,object) {
    let flag=false
    // const jawOutline = landmarks.getJawOutline()

    let minX=face.nose.position.x - face.distances;
    let minY=face.nose.position.y - face.distances;
    let maxX=face.nose.position.x + face.distances;
    let maxY= face.nose.position.y + face.distances;

    console.log(face.nose.x,face.distances)

    ctx.lineWidth=10
    ctx.strokeStyle="red"

    ParamEllipse(ctx,(maxX+minX)/2,(minY+maxY)/2,(maxX-minX)/2,(maxY-minY)/2)

    if(Math.pow(object.x+37.5-(maxX+minX)/2,2)/(Math.pow((maxX-minX)/2,2))+
        Math.pow(object.y+37.5-(maxY+minY)/2,2)/(Math.pow((maxY-minY)/2,2))<1){
        flag=true
        return true;
    }
    return flag
}




/**
 * 画出得分条
 * @param canvas 画布
 * @param mark 分数
 */
function drawMarkBar(mark) {
    let canvans=document.getElementById("markbar")
    canvans.style.width=guiState.mark+"%"
}

/**
 * 画蘑菇/boom
 */
function drawObject(ctx,object){
    let img
    if(object==guiState.mushroom){
        img=document.getElementById("img")
    }
    else if(object==guiState.boom){
        img=document.getElementById("boom")
    }
    ctx.drawImage(img,object.x,object.y,object.w,object.h)
}

/**
 * 满分弹出框 todo 还有问题
 */
function successBox(){
    let mark=document.getElementById("mark")
    if(guiState.mark==100){
        mark.onclick=function () {
            alert("Congratulations!")
            $('#your-modal').modal();
        }
    }
}

let printNice={
    x:null,
    y:null
}

let printHeartbroke={
    x:null,
    y:null
}

/**
 * 交互主函数
 * @param webcam 摄像头
 * @param net 人脸识别网络
 */
function interactions(net,webcam) {

    //set up canvas
    //加载canvas控件
    let canvas = loadCanvas('canvas',guiState.canvas.width,guiState.canvas.height)

    //get ctx
    //获得ctx内容
    let ctx = canvas.getContext('2d')

    //蘑菇生成——优化版（待完善）
    let positionX=guiState.canvas.width*(0.25+Math.random()*0.5)
    let positionY=guiState.canvas.height*0.15
    let tempY=positionY
    //炸弹生成
    let boomPositionX=guiState.canvas.width*(0.25+Math.random()*0.5)
    let boomPositionY=guiState.canvas.height*0.15
    let currentY=boomPositionY


    async function detectFaceAndDoInteractions() {

        //1.detect Face LandMarks
        //1.检测人脸边缘
        // console.log(input)
        if (!guiState.usePoseNet){
            let faces = await faceapi.detectAllFaces(webcam).withFaceLandmarks()

            let maxFaceArea = 0;
            let maxFaceIndex = -1;

            for (let i=0;i<faces.length;i++){
                let face = faces[i]
                let area = face.detection.box.area
                if (area>maxFaceArea) {
                    maxFaceArea = area
                    maxFaceIndex = i
                }
            }

            let face;

            if (maxFaceIndex!=-1){
                face = faces[maxFaceIndex]
            }

            //2.draw camera image and mark line in canvas
            //2.将摄像头获得的画面画到canvas上并画出得分条

            //将摄像头获得的画面画到canvas上
            ctx.clearRect(0,0,guiState.canvas.width,guiState.canvas.height)
            if (guiState.canvas.flipHorizontal){
                ctx.save()
                ctx.scale(-1,1)
                ctx.translate(-guiState.canvas.width,0)
                ctx.drawImage(webcam,0,0,guiState.canvas.width,guiState.canvas.height)
                ctx.restore()
            }
            else{
                ctx.drawImage(webcam,0,0,guiState.canvas.width,guiState.canvas.height)
            }

            //Debug用 画出人脸边缘框
            // if (face!=null){
            //     const landmarks = face.landmarks
            //     const jawOutline = landmarks.getJawOutline()
            //     //console.log(jawOutline)
            //     // jawOutline.forEach(({x,y})=>{
            //     //     drawPoint(ctx, y, x, 2, 'aqua')
            //     // })
            // }

            tempY+=guiState.detaY
            guiState.mushroom=createObject(positionX,tempY,75,75)
            // drawMushroom(ctx)

            //随机生成boom
            if(Math.random()<2){
                currentY+=guiState.detaY
                guiState.boom=createObject(boomPositionX,currentY,75,75)
                //drawObject(ctx,guiState.boom)
            }
            //draw mark line
            //画出得分条
            drawMarkBar(guiState.mark)

            ctx.save()
            ctx.scale(-1,1)
            ctx.translate(-guiState.canvas.width,0)

            //3.if face exist
            //3.如果人脸存在
            if (face!=null){
                //if mushroom exist
                //如果蘑菇存在
                if (guiState.mushroom){
                    //4.if touch mushroom
                    //如果脸部框接触到蘑菇
                    if (isFaceTouchObject(face,ctx,guiState.mushroom)){
                        //4.1 change mark
                        //修改得分
                        guiState.mark+=5
                        document.getElementById("mark").innerHTML="得分："+guiState.mark;
                        //4.2 remove mushroom

                        //画nice
                        printNice = {
                            x:guiState.webcam.width-positionX-50,
                            y:positionY
                        }

                        positionX=guiState.canvas.width*(0.15+Math.random()*0.6)
                        positionY=guiState.canvas.height*0.15
                        tempY=positionY
                        tempY+=guiState.detaY
                        guiState.mushroom=createObject(positionX,tempY,75,75)
                        drawObject(ctx,guiState.mushroom)
                    }
                    //4.else
                    //如果没接触蘑菇
                    else {
                        //keep mushroom
                        //原有位置重绘蘑菇
                        tempY+=guiState.detaY
                        if(tempY<guiState.canvas.height){
                            guiState.mushroom=createObject(positionX,tempY,75,75)
                            drawObject(ctx,guiState.mushroom)
                        }else {
                            positionX=guiState.canvas.width*(0.15+Math.random()*0.6)
                            positionY=guiState.canvas.height*0.15
                            tempY=positionY
                            tempY+=guiState.detaY
                            guiState.mushroom=createObject(positionX,tempY,75,75)
                            drawObject(ctx,guiState.mushroom)
                        }

                    }

                }
                //如果蘑菇不存在
                // else{
                //     //new a mushroom
                //     //设置并绘制蘑菇
                //     // guiState.mushroom=createMushroom(positionX,tempY,75,75)
                //     // drawMushroom(ctx)
                // }

                //如果boom存在
                if (guiState.boom){
                    //4.if touch boom
                    //如果脸部框接触到boom
                    if (isFaceTouchObject(face,ctx,guiState.boom)){
                        //4.1 change mark
                        //修改得分
                        guiState.mark-=5
                        document.getElementById("mark").innerHTML="得分："+guiState.mark;
                        //4.2 remove mushroom

                        //画nice
                        printHeartbroke = {
                            x:guiState.webcam.width*0.45,
                            y:guiState.webcam.height*0.8
                        }

                        guiState.boom=null
                        boomPositionX=guiState.canvas.width*(0.25+Math.random()*0.5)
                        boomPositionY=guiState.canvas.height*0.15
                        currentY=boomPositionY
                        // currentY+=guiState.detaY
                        // guiState.boom=createObject(boomPositionX,currentY,75,75)
                        // drawObject(ctx,guiState.boom)
                    }
                    //4.else
                    //如果没接触boom
                    else {
                        //keep mushroom
                        //原有位置重绘蘑菇
                        currentY+=guiState.detaY
                        if(currentY<guiState.canvas.height){
                            guiState.boom=createObject(boomPositionX,currentY,75,75)
                            drawObject(ctx,guiState.boom)
                        }else {
                            boomPositionX=guiState.canvas.width*(0.25+Math.random()*0.5)
                            boomPositionY=guiState.canvas.height*0.15
                            currentY=boomPositionY
                            currentY+=guiState.detaY
                            guiState.boom=createObject(boomPositionX,currentY,75,75)
                            drawObject(ctx,guiState.boom)
                        }
                    }

                }
            }

            ctx.restore();

            let nice=document.getElementById("nice")
            if (printNice!=null){
                ctx.drawImage(nice,printNice.x,printNice.y,300,100)
            }

            let heartbroke=document.getElementById("heartbroke")
            if (printHeartbroke!=null){
                ctx.drawImage(heartbroke,printHeartbroke.x,printHeartbroke.y,100,100)
            }
        }
        else {
            let pose = await net.estimateMultiplePoses(webcam);

            let poses = []

            poses.push(pose)

            poses.forEach(pose=>{
                //detect faces
                let faces = pose.map(person=>{
                    let faces = person.keypoints.slice(0,5);
                    let distances = []
                    for (let i=1;i<5;i++){
                        let distance = euclidean(faces[0],faces[i])
                        distances.push(distance)
                    }
                    let meanDistance = math.mean(distances)
                    return {nose:faces[0],distances:meanDistance}
                })

                let faceDistances = faces.map(face=>{
                    return face.distances
                })

                let maxFaceDistance = math.max(faceDistances)
                let face = faces[faceDistances.indexOf(maxFaceDistance)]
                face.distances = 120

                let faceIndex = faces.length;
                faces.push(face)

                if (face.length>3){
                    let y=0;
                    let x=0;
                    let config = [0.6,0.3,0.1]
                    for (let i =0;i<3;i++){
                        let index = faceIndex-i
                        x+= faces[index].position.x*config[index];
                        y+= faces[index].position.y*config[index];
                    }
                    face.position.x=x
                    face.position.y=y
                }

                console.log(faces,face)

                //将摄像头获得的画面画到canvas上
                ctx.clearRect(0,0,guiState.canvas.width,guiState.canvas.height)
                if (guiState.canvas.flipHorizontal){
                    ctx.save()
                    ctx.scale(-1,1)
                    ctx.translate(-guiState.canvas.width,0)
                    ctx.drawImage(webcam,0,0,guiState.canvas.width,guiState.canvas.height)
                    ctx.restore()
                }
                else{
                    ctx.drawImage(webcam,0,0,guiState.canvas.width,guiState.canvas.height)
                }

                //2.draw camera image and mark line in canvas
                //2.将摄像头获得的画面画到canvas上并画出得分条



                //Debug用 画出人脸边缘框
                // if (face!=null){
                //     const landmarks = face.landmarks
                //     const jawOutline = landmarks.getJawOutline()
                //     //console.log(jawOutline)
                //     // jawOutline.forEach(({x,y})=>{
                //     //     drawPoint(ctx, y, x, 2, 'aqua')
                //     // })
                // }

                tempY+=guiState.detaY
                guiState.mushroom=createObject(positionX,tempY,75,75)
                // drawMushroom(ctx)

                //随机生成boom
                if(Math.random()<0.05){
                    currentY+=guiState.detaY
                    guiState.boom=createObject(boomPositionX,currentY,75,75)
                    //drawObject(ctx,guiState.boom)
                }
                //draw mark line
                //画出得分条
                drawMarkBar(guiState.mark)

                ctx.save()
                ctx.scale(-1,1)
                ctx.translate(-guiState.canvas.width,0)

                //3.if face exist
                //3.如果人脸存在
                if (face!=null){
                    //if mushroom exist
                    //如果蘑菇存在
                    if (guiState.mushroom){
                        //4.if touch mushroom
                        //如果脸部框接触到蘑菇
                        if (isFaceTouchObjectWithPoseNet(face,ctx,guiState.mushroom)){
                            //4.1 change mark
                            //修改得分
                            guiState.mark+=5
                            document.getElementById("mark").innerHTML="得分："+guiState.mark;
                            //4.2 remove mushroom

                            //画nice
                            printNice = {
                                x:guiState.webcam.width-positionX-50,
                                y:positionY
                            }

                            positionX=guiState.canvas.width*(0.15+Math.random()*0.6)
                            positionY=guiState.canvas.height*0.15
                            tempY=positionY
                            tempY+=guiState.detaY
                            guiState.mushroom=createObject(positionX,tempY,75,75)
                            drawObject(ctx,guiState.mushroom)
                        }
                        //4.else
                        //如果没接触蘑菇
                        else {
                            //keep mushroom
                            //原有位置重绘蘑菇
                            tempY+=guiState.detaY
                            if(tempY<guiState.canvas.height){
                                guiState.mushroom=createObject(positionX,tempY,75,75)
                                drawObject(ctx,guiState.mushroom)
                            }else {
                                positionX=guiState.canvas.width*(0.15+Math.random()*0.6)
                                positionY=guiState.canvas.height*0.15
                                tempY=positionY
                                tempY+=guiState.detaY
                                guiState.mushroom=createObject(positionX,tempY,75,75)
                                drawObject(ctx,guiState.mushroom)
                            }

                        }

                    }
                    //如果蘑菇不存在
                    // else{
                    //     //new a mushroom
                    //     //设置并绘制蘑菇
                    //     // guiState.mushroom=createMushroom(positionX,tempY,75,75)
                    //     // drawMushroom(ctx)
                    // }

                    //如果boom存在
                    if (guiState.boom){
                        //4.if touch boom
                        //如果脸部框接触到boom
                        if (isFaceTouchObjectWithPoseNet(face,ctx,guiState.boom)){
                            //4.1 change mark
                            //修改得分
                            guiState.mark-=5
                            document.getElementById("mark").innerHTML="得分："+guiState.mark;
                            //4.2 remove mushroom

                            //画nice
                            printHeartbroke = {
                                x:guiState.webcam.width-face.nose.position.x+50,
                                y:guiState.webcam.height-face.nose.position.y+50
                            }

                            guiState.boom=null
                            boomPositionX=guiState.canvas.width*(0.25+Math.random()*0.5)
                            boomPositionY=guiState.canvas.height*0.15
                            currentY=boomPositionY
                            // currentY+=guiState.detaY
                            // guiState.boom=createObject(boomPositionX,currentY,75,75)
                            // drawObject(ctx,guiState.boom)
                        }
                        //4.else
                        //如果没接触boom
                        else {
                            //keep mushroom
                            //原有位置重绘蘑菇
                            currentY+=guiState.detaY
                            if(currentY<guiState.canvas.height){
                                guiState.boom=createObject(boomPositionX,currentY,75,75)
                                drawObject(ctx,guiState.boom)
                            }else {
                                boomPositionX=guiState.canvas.width*(0.25+Math.random()*0.5)
                                boomPositionY=guiState.canvas.height*0.15
                                currentY=boomPositionY
                                currentY+=guiState.detaY
                                guiState.boom=createObject(boomPositionX,currentY,75,75)
                                drawObject(ctx,guiState.boom)
                            }
                        }

                    }
                }

                ctx.restore();

                let nice=document.getElementById("nice")
                if (printNice!=null){
                    ctx.drawImage(nice,printNice.x,printNice.y,300,100)
                }

                let heartbroke=document.getElementById("heartbroke")
                if (printHeartbroke!=null){
                    ctx.drawImage(heartbroke,printHeartbroke.x,printHeartbroke.y,100,100)
                }

            })


        }


        successBox()
        //播放下一帧

        requestAnimationFrame(detectFaceAndDoInteractions);

    }

    setInterval(function () {
        printNice = null;
        printHeartbroke=null;
    },1000)

    detectFaceAndDoInteractions()
}

const url = getFrontUrl()

async function bindPage() {

    let net = await posenet.load(0.75);


    //load face detection network
    await faceapi.loadFaceDetectionModel(`${url}/static/face/ssd_mobilenetv1_model-weights_manifest.json`);
    await faceapi.loadFaceLandmarkModel(`${url}//static/face/face_landmark_68_model-weights_manifest.json`)

    //console.log(faceapi.nets)

    //get camera list
    let cameras = await getCameraList()

    //set up webcam
    const webcam = await loadCamera(cameras[0].id,guiState.webcam,'webcam');

    //console.log(webcam)

    //detect face and do interactions
    interactions(net,webcam)
}

bindPage()
