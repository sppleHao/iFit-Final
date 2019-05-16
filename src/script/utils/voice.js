import {getAngles} from "./config";

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

const angels = getAngles();

export function angelVoice(angelIndex,state,flip) {
    // baidu TTS
    let str = ""

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
            str = AngelKeysInChineseInStateOneFlip[angelIndex]
        }
        else {
            str = AngelKeysInChineseInStateOne[angelIndex]
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
