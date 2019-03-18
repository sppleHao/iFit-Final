import {loadCamera} from "./utils/webcam";
import {loadCanvas} from "./utils/canvas";
import {loadFaceDetectionModel} from "./net/faceDetection/src/net";

const guiState = {
    canvas:{
        width:400,
        height:600,
        flipHorizontal:true,
    },
    webcam:{
        width:400,
        height:600
    }
}

function interactions(webcam,net) {

    //set up canvas
    let canvas = loadCanvas('canvas',guiState.canvas.width,guiState.canvas.height)

    //get ctx
    let ctx = canvas.getContext('2d')

    async function detectFaceAndDoInteractions() {
        //1.detect Face

        let face = net.detectSingleFace(webcam)

        //2.draw camera image and mark line in canvas
        //draw webcam
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
        //draw mark line
        //todo


        //3.if face exist
        if (faceExist){
            //if mushroom exist
            if (mushroomExist){

                //4.if touch mushroom
                if (touchMushroom){
                    //4.1 change mark
                    //4.2 remove mushroom
                }
                //4.else
                else {
                    //keep mushroom
                }

            }
            else{
                //new a mushroom
            }
        }
        //3.if face NO EXIST
        else{
            if (mushroomExist){
                //remove mashroom
            }
            else{
                //do nothing
            }
        }

        requestAnimationFrame(detectFaceAndDoInteractions);
    }

    detectFaceAndDoInteractions()
}

async function bindPage() {

    //load face detection network
    const net = await loadFaceDetectionModel();

    //set up webcam
    const webcam = await loadCamera('video',null,guiState.webcam.width,guiState.webcam.height);

    //detect face and do interactions
    // interactions(webcam,net);
}

bindPage();