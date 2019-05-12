import * as tf from '@tensorflow/tfjs'
import * as $ from 'jquery'
import {getFrontUrl} from "../../../config";

const DEBUG = 0
const JOINT_NAMES = [
    'rightAnkle',
    'rightKnee',
    'rightHip',
    'leftHip',
    'leftKnee',
    'leftAnkle',
    'pelvis',
    'thorax',
    'upperNeck',
    'headTop',
    'rightWrist',
    'rightElbow',
    'rightShoulder',
    'leftShoulder',
    'leftElbow',
    'leftWrist'
]

export class IFitNetHR {
    /**
     * initilize
     */
    constructor(model){
        this.model = model
        this.generateTiny()
    }

    generate(){
        this.numClass = 16
        this.numChannels = 256
        this.inres = [256,256]
        this.outres = [64,64]
        this.kpConfidenceThreshold = 1e-6
        this.keys = JOINT_NAMES
        this.guassFilter = this.gaussKernel(4,0.5)
    }

    generateTiny(){
        this.numClass = 16
        this.numChannels = 128
        this.inres = [192,192]
        this.outres = [48,48]
        this.kpConfidenceThreshold = 1e-6
        this.keys = JOINT_NAMES
        this.gaussFilter = this.gaussKernel(4,0.5)
    }

    //gaussFilter
    gauss(x,y,sigma){
        let z = 2 * Math.PI * sigma *sigma
        return 1.0 / z * Math.exp(-(x * x + y * y) / 2 / (sigma * sigma))
    }

    gaussKernel(truncate,sigma){
        let kernel = tf.tidy(()=>{
            let radius = Math.floor(truncate * sigma+0.5)
            let sideLength = radius*2 +1

            let result = []
            for (let i =0 ; i<sideLength;i++){
                for (let j =0 ; j<sideLength;j++) {
                    result.push(this.gauss(i-radius,j-radius,sigma))
                }
            }

            //through 2d tensor filter
            let kernel = tf.tensor2d(result,[sideLength,sideLength],'float32')

            let all = kernel.sum()
            kernel = kernel.div(all)

            return kernel
        })

        return kernel
    }

    /**
     *
     * @param heatmap (shape:[1,outChannels,outChannels,numClass])
     * @param scale
     * @returns {*[]}
     */

    async processHeatmap(heatmap,scale){
        let out =tf.tidy(()=>{
            const shape = heatmap.shape
            const length = heatmap.shape.length
            const lastShape = heatmap.shape[length-1]

            const newScale = scale.mul(tf.scalar(4))
            const gaussKernel = this.gaussFilter
            const kernelLength = gaussKernel.shape[0]
            const kernel = tf.reshape(gaussKernel,[kernelLength,kernelLength,1,1])
            const size  = tf.scalar(shape[1]).toInt()
            let maps = tf.split(heatmap,lastShape,-1)

            //index 0 joint
            let map = maps[0]
            //Convolve Gauss
            map  = tf.conv2d(map,kernel,[1,1],'same')
            const m = tf.reshape(map,[-1])
            const arg = tf.argMax(m)
            let keypoints = tf.expandDims(tf.stack([arg.mod(size).toInt() , arg.floorDiv(size).toInt()],-1).toFloat().mul(newScale),0)
            let scores = tf.stack([m.max()],-1)

            if (DEBUG){
                scale.print()
                tf.stack([arg.mod(size).toInt() , arg.floorDiv(size).toInt()],-1).mul(newScale).print()
            }

            //1 - K-1 joints
            for (let i=1;i<lastShape;i++){
                let map = maps[i]
                //Convolve Gauss
                map  = tf.conv2d(map,kernel,[1,1],'same')

                const m = tf.reshape(map,[-1])
                const arg = tf.argMax(m)
                const keypoint = tf.expandDims(tf.stack([arg.mod(size).toInt() , arg.floorDiv(size).toInt()],-1).toFloat().mul(newScale),0)
                const score = tf.stack([m.max()],-1)

                keypoints = keypoints.concat(keypoint,0)
                scores = scores.concat(score)
            }

            if (DEBUG){
                console.log('kp',keypoints)
                keypoints.print()
            }

            return [keypoints,scores]
        })
        return out
    }

    /***
     *  Normalize Image
     * @param imageData
     * @param mean
     * @returns {TensorContainer}
     */
    normalize(imageData, mean){
        return tf.tidy(()=>{
            let i = imageData.toFloat()
            const scale = tf.scalar(255)
            i = i.div(scale)
            i = i.sub(mean)
            return i
        })
    }

    /**
     * estimate pose
     * @param imageElement
     * @param flipHorizontal
     * @returns {Promise<{score: *, keypoints: Array}>}
     */
    async estimateSinglePose(imageElement, flipHorizontal){

        //initialize input tensor and scale of origin input
        const [inputTensor,scale,h2] = tf.tidy(()=>{
            const mean = tf.tensor1d([0.4404, 0.4440, 0.4327])
            const input = tf.fromPixels(imageElement)
            const [imageWidth,imageHeight]  = input.shape.slice(0,2)
            const scale = tf.tensor1d([imageHeight * 1.0 /this.inres[1],imageWidth*1.0 / this.inres[0]])

            let inputTensor = this.normalize(input,mean)
            if (flipHorizontal){
                inputTensor = inputTensor.reverse(1)
            }
            inputTensor = inputTensor.expandDims(0)
            inputTensor = tf.image.resizeBilinear(inputTensor,this.inres)

            const h2 = this.model.predict(inputTensor)

            return [inputTensor,scale,h2]
        })


        const [jointsTensor,scoresTensor] =await this.processHeatmap(h2,scale)
        const mean = scoresTensor.mean()

        const meanScore = await mean.data()
        const joints = await jointsTensor.data()
        const scores = await scoresTensor.data()

        tf.dispose(inputTensor)
        tf.dispose(scale)
        tf.dispose(h2)
        tf.dispose(mean)
        tf.dispose(jointsTensor)
        tf.dispose(scoresTensor)

        let keypoints = []

        for (let i =0 ; i<scores.length;i++){
            let keyPoint = {
                part:this.keys[i],
                position:{
                    x:joints[2*i],
                    y:joints[2*i+1]
                },
                score:scores[i],
            }
            keypoints.push(keyPoint)
        }

        let pose = {
            score:meanScore,
            keypoints:keypoints
        }

        return pose
    }

}
