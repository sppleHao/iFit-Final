import {getAngles} from "./config";
import * as $ from 'jquery'

const linkKeysInChinese = [
    '右小腿',//0 右小腿
    '右大腿', // 1 右大腿
    '左大腿', //2,
    '左小腿', //3,
    '右大臂', //4, //右大臂
    '右小臂', //5, //右小臂
    '右锁骨', //6, //右锁骨
    '左锁骨',//7,
    '左小臂',//8,
    '左大臂',//9,
    '颈椎', //10, //颈椎
    '右链',//11,
    '左链',//12,
    '胯',//13
]

// const links = [[0,1],[1,2],[4,3],[5,4],[10,11], [11,12],[12,8],[13,8],[14,13],[15,14],[8,9],[2,8],[3,8],[2,3]]

//>
const AngelKeysInChineseInStateOne = [
    '下蹲', //01
    '下蹲', //23
    '右臂合拢', //45
    '右臂不要与肩膀平行', //56
    '右肩抬高', //6 10
    '左肩抬高', //10 7
    '左臂不要与肩膀平行', //7 8
    '左臂合拢',// 89
    '盆骨前倾', //1 11
    '盆骨前倾', //2 12
    '腰部向右', //11 13
    '腰部向右', //13 12
    '右腿合拢', //1 13
    '左腿张开'
]

const AngelKeysInStateOne = [
    'squart', //01
    'squart', //23
    'folded right arm', //45
    'right arms should not be parallel with shoulder', //56
    'raise right shoulder', //6 10
    'raise left shoulder', //10 7
    'left arms should not be parallel with shoulder', //7 8
    'folded left arm',// 89
    'lean forward pelvis', //1 11
    'lean forward pelvis', //2 12
    'right bend', //11 13
    'right bend', //13 12
    'close right leg', //1 13
    'open left leg'
]

const AngelKeysInChineseInStateOneFlip = [
    '下蹲', //01
    '下蹲', //23
    '左臂合拢', //45
    '左臂不要与肩膀平行', //56
    '左肩抬高', //6 10
    '右肩抬高', //10 7
    '右臂不要与肩膀平行', //7 8
    '右臂合拢',// 89
    '盆骨前倾', //1 11
    '盆骨前倾', //2 12
    '腰部向左', //11 13
    '腰部向左', //13 12
    '左腿合拢', //1 13
    '右腿张开'
]

const AngelKeysInStateOneFlip = [
    'squart', //01
    'squart', //23
    'folded left arm', //45
    'left arms should not be parallel with shoulder', //56
    'raise left shoulder', //6 10
    'raise right shoulder', //10 7
    'right arms should not be parallel with shoulder', //7 8
    'folded right arm',// 89
    'lean forward pelvis', //1 11
    'lean forward pelvis', //2 12
    'left bend', //11 13
    'left bend', //13 12
    'close left leg', //1 13
    'open right leg'
]

//<
const AngelKeysInChineseInStateZero = [
    '起立', //01
    '起立', //23
    '右臂伸直', //45
    '右臂平行于肩', //56
    '右肩下沉', //6 10
    '左肩下沉', //10 7
    '左臂平行于肩', //7 8
    '左臂伸直',// 89
    '盆骨后倾', //1 11
    '盆骨后倾', //2 12
    '腰部向左', //11 13
    '腰部向左', //13 12
    '右腿张开', //1 13
    '左腿合拢'
]

const AngelKeysInStateZero = [
    'stand up', //01
    'stand up', //23
    'stretch right arm', //45
    'keep right arms be parallel with shoulder', //56
    'sink left shoulder', //6 10
    'sink right shoulder', //10 7
    'keep left arms be parallel with shoulder', //7 8
    'stretch left arm',// 89
    'lean backward pelvis', //1 11
    'lean backward pelvis', //2 12
    'left bend', //11 13
    'left bend', //13 12
    'open right leg', //1 13
    'close left leg'
]

//<
const AngelKeysInChineseInStateZeroFlip = [
    '起立', //01
    '起立', //23
    '左臂伸直', //45
    '左臂平行于肩', //56
    '左肩下沉', //6 10
    '右肩下沉', //10 7
    '右臂平行于肩', //7 8
    '右臂伸直',// 89
    '盆骨后倾', //1 11
    '盆骨后倾', //2 12
    '腰部向右', //11 13
    '腰部向右', //13 12
    '左腿张开', //1 13
    '右腿合拢'
]

const AngelKeysInStateZeroFlip = [
    'stand up', //01
    'stand up', //23
    'stretch left arm', //45
    'keep left arms be parallel with shoulder', //56
    'sink left shoulder', //6 10
    'sink right shoulder', //10 7
    'keep right arms be parallel with shoulder', //7 8
    'stretch right arm',// 89
    'lean backward pelvis', //1 11
    'lean backward pelvis', //2 12
    'right bend', //11 13
    'right bend', //13 12
    'open left leg', //1 13
    'close right leg'
]

const angels = getAngles();

export function angelVoice(angelIndex,state,flip,inChinese=false) {
    // baidu TTS
    let str = ""

    if (inChinese){
        if (state==0){
            if (flip){
                str = AngelKeysInChineseInStateZero[angelIndex]

            }
            else {
                str = AngelKeysInChineseInStateZeroFlip[angelIndex]

            }
        }
        else {
            if (flip){
                str = AngelKeysInChineseInStateOne[angelIndex]
            }
            else {
                str = AngelKeysInChineseInStateOneFlip[angelIndex]
            }
        }
    }
    else {
        if (state==0){
            if (flip){
                str = AngelKeysInStateZero[angelIndex]

            }
            else {
                str = AngelKeysInStateZeroFlip[angelIndex]

            }
        }
        else {
            if (flip){
                str = AngelKeysInStateOne[angelIndex]
            }
            else {
                str = AngelKeysInStateOneFlip[angelIndex]
            }
        }
    }



    let url = "http://tts.baidu.com/text2audio?lan=zh&ie=UTF-8&text=" + encodeURI(str);
    let n = new Audio(url);
    n.src = url;
    n.play();
}

export function simpleVoice(str) {
    // baidu TTS

    let url = "http://tts.baidu.com/text2audio?lan=zh&ie=UTF-8&text=" + encodeURI(str);
    let n = new Audio(url);
    n.src = url;
    n.play();
}
