/**
 *  get all camera devices
 */
export async function getCameraList() {

    let cameras =navigator.mediaDevices.enumerateDevices()
        .then(function(devices) {
            let cameras = []
            devices.forEach(function(device) {
                if (device.kind=='videoinput'){
                    let camera = {
                        name:device.label,
                        id:device.deviceId
                    }
                    cameras.push(camera)
                }
            })
            return cameras
        })
        .catch(function(err) {
            console.log(err.name + ": " + err.message);
        })

    return cameras
}

/**
 * set camera steams
 */
async function setupCamera(deviceId,videoConfig,el) {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error(
            'Browser API navigator.mediaDevices.getUserMedia not available');
    }

    const video = document.getElementById(el);
    video.width = videoConfig.width;
    video.height = videoConfig.height;

    if (deviceId!=null){
        const stream =await navigator.mediaDevices.getUserMedia({
            audio: false,
            video: {
                deviceId: { exact: deviceId },
                width:videoConfig.width,
                height:videoConfig.height
            }
        })

        video.srcObject = stream;
    }
    else {
        const stream = await navigator.mediaDevices.getUserMedia({
            'audio': false,
            'video': {
                facingMode: 'user',
                width: videoConfig.width,
                height: videoConfig.height,
            },
        })

        video.srcObject = stream;
    }

    return new Promise((resolve) => {
        video.onloadedmetadata = () => {
            resolve(video)
        }
    })
}
/**
 * load camera
 */
export async function loadCamera(deviceId,videoConfig,el) {
    const camera = await setupCamera(deviceId,videoConfig,el)
    camera.play()

    return camera
}