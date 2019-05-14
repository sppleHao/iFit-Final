import {getAngles, getLinks} from "./config";

const links = getLinks();
const angles = getAngles();

export function angelArrayToJointMask(angelIndexArray) {
    let jointArray = []
    for(let i=0;i<16;i++){
        jointArray.push(false)
    }
    angelIndexArray.forEach(angelIndex=>{
        let [l1,l2] = angles[angelIndex];
        let [j1,j2] = links[l1];
        let [j3,j4] = links[l2];
        jointArray[j1] = true;
        jointArray[j2] = true;
        jointArray[j3] = true;
        jointArray[j4] = true;
    })

    return jointArray
}