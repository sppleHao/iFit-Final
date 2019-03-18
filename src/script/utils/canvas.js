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