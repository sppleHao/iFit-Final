import {IFitNetHourglass} from "./iFitNetHg";
import {IFitNetHR} from "./iFitNetHR";
import {getFrontUrl,getIFitNetType} from "../../../utils/config";
import * as tf from '@tensorflow/tfjs'

const url = getFrontUrl();

const hgUrl =`${url}/static/iFitNet_Hourglass/model.json`
const hrUrl =`${url}/static/iFitNet_HR/model.json`

export async function load(modelType = "HRNet"){
    try {
        if (modelType=='Hourglass') {
            console.log('iFitNet:load model ...')
            const model = await tf.loadModel(hgUrl)
            return new IFitNetHourglass(model)
        }
        else if(modelType=='HRNet'){
            console.log('iFitNet:load fast model ...')
            const model = await tf.loadModel(hrUrl)
            return new IFitNetHR(model)
        }

    }
    catch (e) {
        console.log('cannot load iFitNet.')
        console.log(e)
    }
}