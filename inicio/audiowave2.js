// the canvas size
const WIDTH = 1000;
const HEIGHT = 200;

const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");

// options to tweak the look
const opts = {
  smoothing: 0.6,
  fft: 8,
  minDecibels: -70,
  scale: 0.2,
  glow: 7,
  color1: [203, 36, 128],
  color2: [41, 200, 192],
  color3: [24, 137, 218],
  fillOpacity: 0.7,
  lineWidth: 1,
  blend: "screen",
  shift: 50,
  width: 60,
  amp: 1
};

// Interactive dat.GUI controls
const gui = new dat.GUI();
//gui.__proto__.constructor.toggleHide()
// hide them by default
gui.close(); 

// connect gui to opts
gui.addColor(opts, "color1");
gui.addColor(opts, "color2");
gui.addColor(opts, "color3");
gui.add(opts, "fillOpacity", 0, 1);
gui.add(opts, "lineWidth", 0, 10).step(1);
gui.add(opts, "glow", 0, 100);
gui.add(opts, "blend", [
  "normal",
  "multiply",
  "screen",
  "overlay",
  "lighten",
  "difference"
]);
gui.add(opts, "smoothing", 0, 1);
gui.add(opts, "minDecibels", -100, 0);
gui.add(opts, "amp", 0, 5);
gui.add(opts, "width", 0, 60);
gui.add(opts, "shift", 0, 200);


let context;
let analyser;

// Array to hold the analyzed frequencies
let freqs;

navigator.getUserMedia =
  navigator.getUserMedia ||
  navigator.webkitGetUserMedia ||
  navigator.mozGetUserMedia ||
  navigator.msGetUserMedia;

/**
 * Create an input source from the user media stream, connect it to
 * the analyser and start the visualization.
 */
function onStream(stream) {
  console.log("onStream");
  const input = context.createMediaStreamSource(stream);
  input.connect(analyser);
  requestAnimationFrame(visualize);
}

/**
 * Display an error message.
 */
function onStreamError(e) {
  document.body.innerHTML = "<h1>This pen only works with https://</h1>";
  console.log(e);
}

/**
 * Utility function to create a number range
 */
function range(i) {
  return Array.from(Array(i).keys());
}

// shuffle frequencies so that neighbors are not too similar
const shuffle = [1, 3, 0, 4, 2];

/**
 * Pick a frequency for the given channel and value index.
 *
 * The channel goes from 0 to 2 (R/G/B)
 * The index goes from 0 to 4 (five peaks in the curve)
 *
 * We have 2^opts.fft frequencies to choose from and
 * we want to visualize most of the spectrum. This function
 * returns the bands from 0 to 28 in a nice distribution.
 */
function freq(channel, i) {
  const band = 2 * channel + shuffle[i] * 6;
  return freqs[band];
}

/**
 * Returns the scale factor fot the given value index.
 * The index goes from 0 to 4 (curve with 5 peaks)
 */
function scale(i) {
  const x = Math.abs(2 - i); // 2,1,0,1,2
  const s = 3 - x;           // 1,2,3,2,1
  return s / 3 * opts.amp; 
}

/**
 *  This function draws a path that roughly looks like this:
 *       .
 * __/\_/ \_/\__
 *   \/ \ / \/
 *       '
 *   1 2 3 4 5
 *          
 * The function is called three times (with channel 0/1/2) so that the same
 * basic shape is drawn in three different colors, slightly shifted and
 * each visualizing a different set of frequencies. 
 */
function path(channel) {
  
  //console.log(" [channel] ", channel);

  // Read color1, color2, color2 from the opts
  const color = opts[`color${channel + 1}`].map(Math.floor);
  
  // turn the [r,g,b] array into a rgba() css color
  ctx.fillStyle = `rgba(${color}, ${opts.fillOpacity})`;
  
  // set stroke and shadow the same solid rgb() color
  ctx.strokeStyle = ctx.shadowColor = `rgb(${color})`;
  
  ctx.lineWidth = opts.lineWidth;
  ctx.shadowBlur = opts.glow;
  ctx.globalCompositeOperation = opts.blend;
  
  const m = HEIGHT / 2; // the vertical middle of the canvas

  // for the curve with 5 peaks we need 15 control points

  // calculate how much space is left around it
  const offset = (WIDTH - 15 * opts.width) / 2;

  // calculate the 15 x-offsets
  const x = range(15).map(
    i => offset + channel * opts.shift + i * opts.width
  );
  
  // pick some frequencies to calculate the y values
  // scale based on position so that the center is always bigger
  const y = range(5).map(i =>
    Math.max(0, m - scale(i) * freq(channel, i))
  );
    
  const h = 2 * m;

  //console.log(" [h, m, x, y] ", h, m, x, y);

  const mycut = 100;

  //h = 50;

  ctx.beginPath();
  ctx.moveTo(0, m); // start in the middle of the left side
  ctx.lineTo(x[0], m + 1); // straight line to the start of the first peak
   
  ctx.bezierCurveTo(x[1], m + 1, x[2], y[0], x[3], y[0]); // curve to 1st value
  ctx.bezierCurveTo(x[4], y[0], x[4], y[1], x[5], y[1]); // 2nd value
  ctx.bezierCurveTo(x[6], y[1], x[6], y[2], x[7], y[2]); // 3rd value
  ctx.bezierCurveTo(x[8], y[2], x[8], y[3], x[9], y[3]); // 4th value
  ctx.bezierCurveTo(x[10], y[3], x[10], y[4], x[11], y[4]); // 5th value
  
  ctx.bezierCurveTo(x[12], y[4], x[12], m, x[13], m); // curve back down to the middle
  
  //1000
  ctx.lineTo(1000, m + 1); // straight line to the right edge
  ctx.lineTo(x[13], m - 1); // and back to the end of the last peak
  
  // now the same in reverse for the lower half of out shape
  
  ctx.bezierCurveTo(x[12], m, x[12], h - y[4], x[11], h - y[4]);
  ctx.bezierCurveTo(x[10], h - y[4], x[10], h - y[3], x[9], h - y[3]);
  ctx.bezierCurveTo(x[8], h - y[3], x[8], h - y[2], x[7], h - y[2]);
  ctx.bezierCurveTo(x[6], h - y[2], x[6], h - y[1], x[5], h - y[1]);
  ctx.bezierCurveTo(x[4], h - y[1], x[4], h - y[0], x[3], h - y[0]);
  ctx.bezierCurveTo(x[2], h - y[0], x[1], m, x[0], m);
  
  ctx.lineTo(0, m); // close the path by going back to the start
  
  ctx.fill();
  ctx.stroke();
}

/**
 * requestAnimationFrame handler that drives the visualization
 */
function visualize() {
  // set analysert props in the loop react on dat.gui changes
  analyser.smoothingTimeConstant = opts.smoothing;
  analyser.fftSize = Math.pow(2, opts.fft);
  analyser.minDecibels = opts.minDecibels;
  analyser.maxDecibels = 0;
  analyser.getByteFrequencyData(freqs);
  
  // set size to clear the canvas on each frame
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  
  // draw three curves (R/G/B)
  path(0);
  path(1);
  path(2);

  // schedule next paint
  requestAnimationFrame(visualize);
}

function start() {
  context = new AudioContext();
  analyser = context.createAnalyser();
  freqs = new Uint8Array(analyser.frequencyBinCount);
  document.querySelector("button").remove();

  var constraints = { deviceId: { exact: 'default' } };

  navigator.getUserMedia({ audio: constraints }, onStream, onStreamError);

  //let devices = await navigator.mediaDevices.enumerateDevices();   
  //console.log(devices);

}


let hasMic = false;
let hasCamera = false;
let hasPermission = false;

function getDevices() {
  navigator.mediaDevices.enumerateDevices().then(gotDevices).catch(handleError);
}

function handleError(error) {
  console.log('navigator.MediaDevices.getUserMedia error: ', error.message, error.name);
}

function gotDevices(deviceInfos) {

  let audiooutputArray = [];
  let videoinputArray = [];

  for (let i = 0; i !== deviceInfos.length; ++i) {
    const deviceInfo = deviceInfos[i];
    if (deviceInfo.deviceId == '') {
      continue;
    }

    hasPermission = true;

    if(deviceInfo.kind === 'audiooutput') {
      hasMic = true;
      audiooutputArray.push({ deviceId: deviceInfo.deviceId, label: deviceInfo.label })
      console.log("id => " + deviceInfo.deviceId, "| label => " + deviceInfo.label);
    }else if (deviceInfo.kind === 'videoinput') {
      hasCamera = true;
      videoinputArray.push({ deviceId: deviceInfo.deviceId, label: deviceInfo.label })
      //console.log("id => " + deviceInfo.deviceId, "| label => " + deviceInfo.label);
    }else if (deviceInfo.kind === 'audioinput') {
      console.log("id => " + deviceInfo.deviceId, "| label => " + deviceInfo.label);
    }

  }

  console.log(audiooutputArray, videoinputArray);

  const constraints = {
    audio: true,
    video: true
  };

  let audioBuscado = audiooutputArray.find( x => x.deviceId != "default" && x.deviceId != "communications" && x.label.indexOf("Altavoces") > -1 );
  console.log(" [ audioBuscado ] ",audioBuscado);

  if (hasMic) {
    //constraints['audio'] = {deviceId: audiooutputArray[0] ? {exact: audiooutputArray[0].deviceId } : undefined}
    constraints['audio'] = {deviceId: audioBuscado ? {exact: audioBuscado.deviceId } : undefined}
    
  }

  if(hasCamera){
    constraints['video'] = {deviceId: videoinputArray[0] ? {exact: videoinputArray[0].deviceId} : undefined};
  }

  if (!hasPermission || hasCamera || hasMic) {
    console.log(" [constraints] ", constraints);
    window.AudioContext = window.AudioContext || window.webkitAudioContext;

    context = new AudioContext();
    analyser = context.createAnalyser();
    console.log("[ analyser ]", analyser);
    freqs = new Uint8Array(analyser.frequencyBinCount);
    document.querySelector("button").remove();
  
    navigator.mediaDevices.getUserMedia = navigator.getUserMedia || navigator.webkitGetUserMedia;
    navigator.mediaDevices.getUserMedia(constraints).then(gotStream).catch(onStreamError);
  }

}
let audioCtx;

const videoElement = document.querySelector('video');

function onStream2(stream) {
  console.log("onStream");
  const input = context.createMediaStreamSource(stream);
  console.log("[ input ]", input);
  input.connect(analyser);
  requestAnimationFrame(visualize);
}

function gotStream(stream) {
  window.stream = stream; // make stream available to console
  videoElement.srcObject = stream;

  stream.onended = function(data) {
    console.log('Stream ended', data);
  };

  console.log(" [getVideoTracks] ", stream.getVideoTracks());
  console.log(" [getAudioTracks] ", stream.getAudioTracks());

  console.log(stream);

  visualizeCanvas(stream);
  // Refresh list in case labels have become available
  //return getDevices();
}


function visualizeCanvas(stream) {
  if (!audioCtx) {
    audioCtx = new AudioContext();
  }

  const source = audioCtx.createMediaStreamSource(stream);

  console.log(" [source] ", source);

  const bufferLength = 2048;
  const analyser = audioCtx.createAnalyser();
  analyser.fftSize = bufferLength;
  const dataArray = new Uint8Array(bufferLength);

  source.connect(analyser);

  draw();

  function draw() {
    const WIDTH = canvas.width;
    const HEIGHT = canvas.height;

    requestAnimationFrame(draw);

    analyser.getByteTimeDomainData(dataArray);

    ctx.fillStyle = "rgb(200, 200, 200)";
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    ctx.lineWidth = 2;
    ctx.strokeStyle = "rgb(0, 0, 0)";

    ctx.beginPath();

    let sliceWidth = (WIDTH * 1.0) / bufferLength;
    let x = 0;

    for (let i = 0; i < bufferLength; i++) {
      let v = dataArray[i] / 128.0;
      let y = (v * HEIGHT) / 2;

      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }

      x += sliceWidth;
    }

    ctx.lineTo(canvas.width, canvas.height / 2);
    ctx.stroke();
  }
}


getDevices();