import * as faceapi from "face-api.js";
import {getCameraList, loadCamera} from "./utils/camera";
import {drawPoint, loadCanvas} from "./utils/canvas";
import {getFrontUrl} from "./utils/config"


const guiState = {
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
    detaY:5,

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
 * 创建mushroom
 * @param x
 * @param y
 * @param w
 * @param h
 * @returns {Object}
 */
function createMushroom(x,y,w,h){
    let mushroom=new Object
    mushroom.x=x
    mushroom.y=y
    mushroom.w=w
    mushroom.h=h
    return mushroom
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
 * 判断face和mushroom是否接触(点是否在框里面)
 * @param face 17个点的脸部边缘 point = {x ,y}
 * @param mushroom 蘑菇的框 [x,y,w,h] x,y左上角的点
 */
function isFaceTouchMushroom(face,ctx) {
    let flag=false
    const landmarks = face.landmarks
    const jawOutline = landmarks.getJawOutline()
    // let midX=jawOutline[8].x
    // let midY=jawOutline[8].y
    //console.log(jawOutline)
    // jawOutline.forEach(({x,y})=>{
    //     if(x>=guiState.mushroom.x && x<=guiState.mushroom.x+guiState.mushroom.w
    //         && y>=guiState.mushroom.y && y<=guiState.mushroom.y+guiState.mushroom.h){
    //         flag=true
    //         return true;
    //     }
    // })
    // console.log(landmarks)
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
    // let wid=jawOutline[16].x-jawOutline[0].x;
    // let hei=jawOutline[8].y-jawOutline[0].y;
    ctx.lineWidth=10
    ctx.strokeStyle="red"
    // ctx.strokeRect(midX-wid/2,midY-2*hei,wid,2*hei)
    // ctx.ellipse(midX-wid/2,midY-2*hei, wid/2, hei, 0,0,Math.PI*2)
    ParamEllipse(ctx,(maxX+minX)/2,(minY+maxY)/2,(maxX-minX)/2,(maxY-minY)/2)
    // drawPoint(ctx, midY+hei, midX+wid/2, 2, 'aqua')
    // drawPoint(ctx, midY+hei, midX-wid/2, 2, 'aqua')
    // drawPoint(ctx, midY-hei, midX-wid/2, 2, 'aqua')
    // drawPoint(ctx, midY-hei, midX+wid/2, 2, 'aqua')
    console.log(Math.pow(guiState.mushroom.x+37.5-(maxX+minX)/2,2)/(Math.pow((maxX-minX)/2,2))+
        Math.pow(guiState.mushroom.y+37.5-(maxY+minY)/2,2)/(Math.pow((maxY-minY)/2,2)))
    if(Math.pow(guiState.mushroom.x+37.5-(maxX+minX)/2,2)/(Math.pow((maxX-minX)/2,2))+
        Math.pow(guiState.mushroom.y+37.5-(maxY+minY)/2,2)/(Math.pow((maxY-minY)/2,2))<1){
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
    // let barctx=canvans.getContext("2d")
    canvans.style.width=guiState.mark+"%"
    // barctx.fillStyle="#F00"
    // barctx.fillRect(0,0,guiState.mark,100)
}

/**
 * 画蘑菇
 */
function drawMushroom(ctx){
    let img=document.getElementById("img")
    ctx.drawImage(img,guiState.mushroom.x,guiState.mushroom.y,guiState.mushroom.w,guiState.mushroom.h)
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
function interactions(webcam) {

    //set up canvas
    //加载canvas控件
    let canvas = loadCanvas('canvas',guiState.canvas.width,guiState.canvas.height)

    //get ctx
    //获得ctx内容
    let ctx = canvas.getContext('2d')


    //蘑菇生成——基础版
    // let positionX=guiState.canvas.width*0.25
    // let positionY=guiState.canvas.height*0.6
    //蘑菇生成——优化版（待完善）
    let positionX=guiState.canvas.width*(0.35+Math.random()*0.4)
    let positionY=guiState.canvas.height*0.2
    let tempY=positionY




    async function detectFaceAndDoInteractions() {

        //1.detect Face LandMarks
        //1.检测人脸边缘
        // console.log(input)
        let face = await faceapi.detectSingleFace(webcam).withFaceLandmarks()

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
        guiState.mushroom=createMushroom(positionX,tempY,75,75)
        // drawMushroom(ctx)

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
                if (isFaceTouchMushroom(face,ctx)){

                    //4.1 change mark
                    //修改得分
                    guiState.mark+=5
                    console.log(guiState.mark.toString())
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
                    guiState.mushroom=createMushroom(positionX,tempY,75,75)
                    drawMushroom(ctx)
                }
                //4.else
                //如果没接触蘑菇
                else {
                    //keep mushroom
                    //原有位置重绘蘑菇
                    tempY+=guiState.detaY
                    if(tempY<guiState.canvas.height){
                        guiState.mushroom=createMushroom(positionX,tempY,75,75)
                        drawMushroom(ctx)
                    }else {
                        positionX=guiState.canvas.width*(0.15+Math.random()*0.6)
                        positionY=guiState.canvas.height*0.15
                        tempY=positionY
                        tempY+=guiState.detaY
                        guiState.mushroom=createMushroom(positionX,tempY,75,75)
                        drawMushroom(ctx)
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


        }

        ctx.restore();

        let nice=document.getElementById("nice")
        if (printNice!=null){
            ctx.drawImage(nice,printNice.x,printNice.y,300,100)
        }

        successBox()
        //播放下一帧

        requestAnimationFrame(detectFaceAndDoInteractions);

    }

    setInterval(function () {
        printNice = null;
    },1000)

    detectFaceAndDoInteractions()
}

const url = getFrontUrl()

async function bindPage() {

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
    interactions(webcam)
}

bindPage()
