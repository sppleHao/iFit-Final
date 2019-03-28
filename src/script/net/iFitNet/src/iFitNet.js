import * as tf from '@tensorflow/tfjs'
import * as $ from 'jquery'

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

const ip = '139.196.138.230'

const poseModelTinyUrl =`http://${ip}:1234/static/ifitnet_tiny/model.json`

export async function load(){
    console.log('iFitNet:load model ...')
    try {
        const model = await tf.loadModel(poseModelTinyUrl)
        return new IFitNet(model)
    }
    catch (e) {
        console.log('cannot load hg model.')
        console.log(e)
    }
}

export class IFitNet {
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
  }

  generateTiny(){
    this.numClass = 16
    this.numChannels = 128
    this.inres = [192,192]
    this.outres = [48,48]
    this.kpConfidenceThreshold = 1e-6
    this.keys = JOINT_NAMES
  }

  //gaussFilter
  gauss(x,y,sigma){
   let z = 2 * Math.PI * sigma *sigma
    return 1.0 / z * Math.exp(-(x * x + y * y) / 2 / (sigma * sigma))
  }

  gaussKernel(truncate,sigma){
    let radius = Math.floor(truncate * sigma+0.5)
    let sideLength = radius*2 +1
    let result = []

    for (let i =0 ; i<sideLength;i++){
      for (let j =0 ; j<sideLength;j++) {
        result.push(this.gauss(i-radius,j-radius,sigma))
      }
    }

    result = tf.tensor2d(result,[sideLength,sideLength],'float32')

    let all = result.sum()

    result = result.div(all)

    return result
  }

  /**
   *
   * @param heatmap (shape:[1,outChannels,outChannels,numClass])
   * @param kpConfidenceThreshold
   * @param scale
   * @returns {*[]}
   */

  async postProcessHeatap(heatmap,kpConfidenceThreshold,scale){
    let out = tf.tidy(()=>{
      const newScale = scale.mul(tf.scalar(4))
      const gaussKernel = this.gaussKernel(4.0,0.5)
      const kernelLength = gaussKernel.shape[0]
      const kernel = tf.reshape(gaussKernel,[kernelLength,kernelLength,1,1])
      const shape = heatmap.shape
      const length = heatmap.shape.length
      const lastShape = heatmap.shape[length-1]
      const size  = tf.scalar(shape[1]).toInt()

      let maps = tf.split(heatmap,lastShape,-1)

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
  normalize(imageData , mean){
      return tf.tidy(()=>{
        let i = imageData.toFloat()

        const scale = tf.scalar(255)
        i = i.div(scale)

        i = i.sub(mean)

        return i
      })
  }

  async estimateSinglePose(imageElement, flipHorizontal){
    const [inputTensor,scale] =tf.tidy(()=>{
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

        return [inputTensor,scale]
    })


      const [h1,h2] = await this.model.predict(inputTensor)

      const [j,s] =await this.postProcessHeatap(h2,this.kpConfidenceThreshold,scale)

      const meanScore = await s.mean().data()

      const joints = await j.data()
      const scores = await s.data()

      j.dispose()
      s.dispose()

      let keypoints = []

      for (let i =0 ; i<scores.length;i++){
          let keyPoint = {
              part:this.keys[i],
              position:{
                x:joints[2*i],
                y:joints[2*i+1]
              },
              score:scores[i],
              active:true,
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
