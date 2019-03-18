/**
 *  Get All Available Cameras In This Device
 *  @returns {Promise<Array>}
 */
export async function getCameraList(){
    let cameraList =navigator.mediaDevices.enumerateDevices()
        .then(function(devices) {
            let cameras = []
            devices.forEach(function(device) {
                if (device.kind=='videoinput'){
                    // filter device which is camera
                    let camera = {
                        name:device.label,
                        id:device.deviceId
                    }
                    cameras.push(camera)
                }
            })
            return cameras;
        })
        .catch(function(err) {
            console.log(err.name + ": " + err.message);
        })

    return cameraList;
}

/**
 * Set up camera use mediaDevice API
 * @param el   HTML ELEMENT
 * @param deviceId  Camera Device Id
 * @returns {Promise<any>}
 */
async function setupCamera(el,deviceId=null,width,height) {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error(
            'Browser API navigator.mediaDevices.getUserMedia not available');
    }

    const camera = document.getElementById(el);

    if (deviceId != null) {
        const stream = await navigator.mediaDevices.getUserMedia({
            audio: false,
            video: {
                deviceId: {exact: deviceId},
                width: width,
                height: height
            }
        });

        camera.srcObject = stream;
    }
    else {
        const stream = await navigator.mediaDevices.getUserMedia({
            'audio': false,
            'video': {
                facingMode: 'user',
                width: width,
                height: height,
            },
        });

        camera.srcObject = stream;
    }

    return new Promise((resolve) => {
        camera.onloadedmetadata = () => {
            resolve(camera);
        }
    })
}

/**
 *  Load camera element
 * @param el   HTML ELEMENT
 * @param deviceId   Camera Device Id
 * @returns {Promise<any>}
 */
export async function loadCamera(el,deviceId = null,width,height) {
    const camera = await setupCamera(el,deviceId,width,height);
    camera.play();

    return camera;
}