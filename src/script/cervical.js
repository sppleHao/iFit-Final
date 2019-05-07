import * as faceapi from "face-api.js";
import {getCameraList, loadCamera} from "./utils/camera";
import {drawPoint, loadCanvas} from "./utils/canvas";
import {getFrontUrl} from "./config"


const guiState = {
    canvas:{
        width:600,
        height:600,
        flipHorizontal:false,
    },
    webcam:{
        width:600,
        height:600
    },
    //当前分数
    mark:0,
    //蘑菇的框
    mushroom:null,
    //人脸中心点 x默认0.5*600  y默认500
    middlePoint:{
        x:0.5*600,
        y:500
    }
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

/**
 * 判断face和mushroom是否接触(点是否在框里面)
 * @param face 17个点的脸部边缘 point = {x ,y}
 * @param mushroom 蘑菇的框 [x,y,w,h] x,y左上角的点
 */
function isFaceTouchMushroom(face) {
    let flag=false
    const landmarks = face.landmarks
    const jawOutline = landmarks.getJawOutline()

    //console.log(jawOutline)
    jawOutline.forEach(({x,y})=>{
        if(x>=guiState.mushroom.x && x<=guiState.mushroom.x+guiState.mushroom.w
            && y>=guiState.mushroom.y && y<=guiState.mushroom.y+guiState.mushroom.h){
            flag=true
            return true;
        }
    })
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
    let positionX=guiState.canvas.width*0.25
    let positionY=guiState.canvas.height*0.6
    //蘑菇生成——优化版（待完善）
    // let positionX=guiState.middlePoint.x+guiState.canvas.width*0.3
    // let positionY=guiState.middlePoint.y

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
        if (face!=null){
            const landmarks = face.landmarks
            const jawOutline = landmarks.getJawOutline()
            guiState.middlePoint=jawOutline[jawOutline.length/2+1]
            //console.log(jawOutline)
            jawOutline.forEach(({x,y})=>{
                drawPoint(ctx, y, x, 2, 'aqua')
            })
        }

        guiState.mushroom=createMushroom(positionX,positionY,50,50)
        drawMushroom(ctx)
        //todo 得分显示
        //draw mark line
        //画出得分条
        drawMarkBar(guiState.mark)

        //3.if face exist
        //3.如果人脸存在
        if (face!=null){
            //if mushroom exist
            //如果蘑菇存在
            if (guiState.mushroom){
                //4.if touch mushroom
                //如果脸部框接触到蘑菇
                if (isFaceTouchMushroom(face)){
                    //4.1 change mark
                    //修改得分
                    guiState.mark+=5
                    console.log(guiState.mark.toString())
                    document.getElementById("mark").innerHTML="得分："+guiState.mark;
                    //4.2 remove mushroom

                    //重新设置蘑菇
                    //蘑菇生成——基础版
                    if(positionX==guiState.canvas.width*0.25){
                        positionX=guiState.canvas.width*0.7
                    }
                    else if(positionX==guiState.canvas.width*0.7){
                        positionX=guiState.canvas.width*0.25
                    }
                    //蘑菇生成——优化版（待完善）
                    // if(positionX>guiState.middlePoint.x){
                    //     positionX=guiState.middlePoint.x-guiState.canvas.width*0.3
                    // }else if(positionX<guiState.middlePoint.x){
                    //     positionX=guiState.middlePoint+guiState.canvas.width*0.3
                    // }
                    guiState.mushroom=createMushroom(positionX,positionY,50,50)
                    drawMushroom(ctx)
                }
                //4.else
                //如果没接触蘑菇
                else {
                    //keep mushroom
                    //原有位置重绘蘑菇
                    guiState.mushroom=createMushroom(positionX,positionY,50,50)
                    drawMushroom(ctx)
                }

            }
            //如果蘑菇不存在
            else{
                //new a mushroom
                //设置并绘制蘑菇
                guiState.mushroom=createMushroom(positionX,positionY,50,50)
                drawMushroom(ctx)
            }
        }
        successBox()
        //播放下一帧
        requestAnimationFrame(detectFaceAndDoInteractions);

    }

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
