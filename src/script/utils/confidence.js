export function filterDeactivateKeypoints(kepoints,minConfidence,deactivateArray) {
    for (let i =0;i<deactivateArray.length;i++){
        kepoints[deactivateArray[i]].active=false
    }

    kepoints.map((kp)=>{
        if (kp.score<minConfidence){
            kp.active = false
        }
    })

    return kepoints
}