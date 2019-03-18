import * as tf from '@tensorflow/tfjs'

const modelUrl = 'http://localhost:1234/static/faceDetection/model.json'

export async function loadFaceDetectionModel(url=null) {
    try {
        if (url==null){
            const model = await tf.loadModel(modelUrl)
            return new faceDetectionNet(model)
        }
        else {
            const model = await  tf.loadModel(url)
            return new faceDetectionNet(model)
        }
    }
    catch (e) {
        console.log('cannot load model, reason: ')
        console.log(e)
    }
}

class faceDetectionNet{
    constructor(model){
        this.model = model
    }

    /**
     *  detect face by video
     *  @param video
     */
    detectSingleFace(video){ //todo
    }
}