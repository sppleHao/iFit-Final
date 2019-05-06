import {IFitNetHourglass} from "./iFitNetHg";
import {IFitNetHR} from "./iFitNetHR";
import {getFrontUrl,getIFitNetType} from "../../../config";
import * as tf from '@tensorflow/tfjs'

const url = getFrontUrl();

const hgUrl =`${url}/static/iFitNet_Hourglass/model.json`
const hrUrl =`${url}/static/iFitNet_HR/model.json`

export async function load(){
    try {
        let modelType = getIFitNetType();
        if (modelType=='Hourglass') {
            console.log('iFitNet:load hourglass model ...')
            const model = await tf.loadModel(hgUrl)
            return new IFitNetHourglass(model)
        }
        else {
            console.log('iFitNet:load hr model ...')
            const model = await tf.loadModel(hrUrl)
            return new IFitNetHR(model)
        }

    }
    catch (e) {
        console.log('cannot load iFitNet.')
        console.log(e)
    }
}