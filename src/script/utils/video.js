import $ from 'jquery'
export async function loadVideoList(videoConfig) {
    let jResult = null
    await $.ajax({
        type:'get',
        url:videoConfig.getVideoListUrl,
    }).done(async function (result) {
        jResult = JSON.parse(result)
        console.log(jResult)
        document.getElementById('app').style = "display:none"
        document.getElementById('main').style = "display:block"
    }).fail(function (jqXHR) {
        alert('Error:' + jqXHR.status);
        return []
    });

    return jResult
}

/**
 * set up video
 * @param videoName
 * @param el ElementId
 * @returns {HTMLElement | null}
 */
function setupVideo(videoName,videoConfig,el) {
    const video = document.getElementById(el);
    video.width = videoConfig.width;
    video.height = videoConfig.height;

    video.src = videoConfig.videoFile.bucket+videoName;

    return video
}

/**
 * load video
 * @returns {Promise<void>}
 */
export async function loadVideo(videoName,videoConfig,el,reload = false) {
    const video = await setupVideo(videoName,videoConfig,el)


    if (!reload){
        //first load, control video state
        video.addEventListener('play',function () {
            videoConfig.videoState='play';
        });

        video.addEventListener('pause',function () {
            videoConfig.videoState='pause';
        });

        video.addEventListener('ended',function () {
            videoConfig.videoState='ended';
            video.pause();
        });
    }
    return video
}