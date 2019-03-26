import * as faceapi from 'face-api.js'

const MobileNetUrl = 'http://localhost:1234/static/weights/ssd_mobilenetv1_model-weights_manifest.json'

async function runDemo() {
    await faceapi.loadSsdMobilenetv1Model(MobileNetUrl)
    console.log(faceapi.nets)
}

runDemo()