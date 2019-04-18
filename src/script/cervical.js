import * as faceapi from "face-api.js";
import {loadCamera} from "./utils/webcam";
import {drawPoint, loadCanvas} from "./utils/canvas";
import * as iFitNet from "./net/iFitNet/src/iFitNet";


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
    //17个点的脸部边缘
    face:null,
    //蘑菇的框
    mushroom:null,
}

/**
 * 判断face和mushrrom是否接触(点是否在框里面)
 * @param face 17个点的脸部边缘 point = {x ,y}
 * @param mushroom 蘑菇的框 [x,y,w,h]
 */
function isFaceTouchMushroom(face,mushroom) {

}

/**
 * 画出得分条
 * @param canvas 画布
 * @param mark 分数
 */
function drawMarkBar(canvas,mark) {

}

/**
 * 交互主函数
 * @param webcam 摄像头
 * @param net 人脸识别网络
 */
function interactions(webcam,net) {

    //set up canvas
    //加载canvas控件
    let canvas = loadCanvas('canvas',guiState.canvas.width,guiState.canvas.height)

    //get ctx
    //获得ctx内容
    let ctx = canvas.getContext('2d')

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
            console.log(jawOutline)
            jawOutline.forEach(({x,y})=>{
                drawPoint(ctx, y, x, 2, 'aqua')
            })
        }

        //todo
        //draw mark line
        //画出得分条
        drawMarkBar(ctx,guiState.mark)

        //3.if face exist
        //3.如果人脸存在
        if (guiState.face!=null){
            //if mushroom exist
            //如果蘑菇存在
            if (guiState.mushroom){
                //4.if touch mushroom
                //如果脸部框接触到蘑菇
                if (isFaceTouchMushroom){
                    //4.1 change mark
                    //修改得分
                    //4.2 remove mushroom
                    //重新设置蘑菇
                }
                //4.else
                //如果没接触蘑菇
                else {
                    //keep mushroom
                    //原有位置重绘蘑菇
                }

            }
            //如果蘑菇不存在
            else{
                //new a mushroom
                //设置并绘制蘑菇
            }
        }

        //播放下一帧
        requestAnimationFrame(detectFaceAndDoInteractions);
    }

    detectFaceAndDoInteractions()
}

async function bindPage() {

    //load pose model
    let net =await iFitNet.load()

    //load face detection network
    await faceapi.loadFaceDetectionModel('http://localhost:1234/static/face/ssd_mobilenetv1_model-weights_manifest.json');
    await faceapi.loadFaceLandmarkModel('http://localhost:1234/static/face/face_landmark_68_model-weights_manifest.json')

    console.log(faceapi.nets)

    //set up webcam
    const webcam = await loadCamera('webcam',null,guiState.webcam.width,guiState.webcam.height);

    console.log(webcam)

    //detect face and do interactions
    interactions(webcam,net)
}

bindPage();