const color = 'aqua';
const boundingBoxColor ='red'

let DEBUG = 0

const links = [[0,1],[1,2],[2,6],[3,6],[4,3],[5,4],[10,11], [11,12],[12,8],[13,8],[14,13],[15,14],[7,8],[8,9],[7,2],[7,3]]

function toTuple({y, x}) {
    return [y, x];
}

/**
 *  load Canvas
 * @param el HTMLElement
 * @param width WIDTH
 * @param height HEIGHT
 * @returns {HTMLElement}
 */
export function loadCanvas(el,width,height) {
    let canvas = document.getElementById(el)
    canvas.width= width
    canvas.height = height
    return canvas
}

/**
 * Draws a point on a canvas
 */
export function drawPoint(ctx, y, x, r, color) {
    ctx.beginPath();
    ctx.arc(x, y, r, 0, 2 * Math.PI);
    ctx.fillStyle = color;
    ctx.fill();
}

/**
 * Draws a line on a canvas
 */
export function drawSegment([ay, ax], [by, bx], color,ctx,lineWidth=2) {
    ctx.beginPath();
    ctx.moveTo(ax , ay );
    ctx.lineTo(bx , by );
    ctx.lineWidth = lineWidth;
    ctx.strokeStyle = color;
    ctx.stroke();
}

/**
 * Draws a pose skeleton
 */
export function drawSkeleton(keypoints, ctx ,color='aqua' ,lineWidth=2) {
    if (keypoints.length==0){
        return;
    }
    else {
        links.forEach((link) => {
            let joint1 = keypoints[link[0]]
            let joint2 = keypoints[link[1]]
            if (joint1.active&&joint2.active){
                drawSegment(toTuple(joint1.position), toTuple(joint2.position), color,ctx,lineWidth)
            }
        })
    }
}

export function drawSkeletonWithMask(kps,ctx,color='aqua',lineWidth=2,mask=null){
    links.forEach((link) => {
        if (mask[link[0]]&&mask[link[1]]){
            let joint1 = kps[link[0]]
            let joint2 = kps[link[1]]
            if (joint1.active&&joint2.active){
                drawSegment(toTuple(joint1.position), toTuple(joint2.position), color,ctx,lineWidth)
            }
        }
    })
}

/**
 * Draw pose keypoints on to a canvas
 */
export function drawKeypoints(keypoints, ctx ,color='aqua' ,radius=3) {
    if (keypoints.length==0){
        return;
    }
    else{
        for (let i = 0; i < keypoints.length; i++) {
            const keypoint = keypoints[i]
            if (DEBUG){
                console.log(keypoint)
            }


            if (keypoint.active){
                const [y, x] = toTuple(keypoint.position)
                drawPoint(ctx, y, x , radius, color)
            }
        }
    }
}

export function drawKeypointsWithMask(kps,ctx,color='aqua',radius=3,mask=null){
    for (let i =0;i<kps.length;i++){
        if (mask[i]&&kps[i].active){
            const [y, x] = toTuple(kps[i].position)
            drawPoint(ctx, y, x , radius, color)
        }
    }
}

/**
 * Draw the bounding box of a pose. For example, for a whole person standing
 * in an image, the bounding box will begin at the nose and extend to one of
 * ankles
 */
export function drawBoundingBox(boundingBox, ctx) {

    ctx.rect(boundingBox.minX, boundingBox.minY,
        boundingBox.maxX - boundingBox.minX, boundingBox.maxY - boundingBox.minY)

    ctx.strokeStyle = boundingBoxColor
    ctx.stroke();
}