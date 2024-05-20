const transcriptElement = window.document.getElementById("transcriptText")
let selectedDevice = 'default'
const selectDeviceElement = window.document.getElementById("selectDevice")
const summarizeElement = window.document.getElementById("summarizeText")
const summarizeButton = window.document.getElementById("summarizeButton")

const getDevices = async () => {

  try {
    const audioDevices = await navigator.mediaDevices.enumerateDevices()

    const filteredDevices = audioDevices.filter(device => device.kind === 'audioinput')

    if(filteredDevices.length > 0){
      selectedDevice = filteredDevices[0].deviceId
    }
    
    filteredDevices.forEach(device => {
      let opt = document.createElement('option')
      opt.value = device.deviceId
      opt.innerHTML = device.label
      selectDeviceElement.appendChild(opt)
    })

  }catch(error){
    console.error(error)
  }

}

const handleDeviceChange = (event) => {
  selectedDevice = event.target.value
  console.log(selectedDevice)
}

const handleSummarize = async (event) => {

  // Change button state
  summarizeButton.removeChild(summarizeButton.firstElementChild)
  let statusSpan = document.createElement('span')
  statusSpan.className = "spinner-border spinner-border-sm"
  statusSpan.role = "status"
  statusSpan.ariaHidden = true
  summarizeButton.appendChild(statusSpan)
  let span = document.createElement('span')
  span.className = "sr-only"
  span.innerHTML = " Loading..."
  summarizeButton.appendChild(span)

  const response = await fetch('/summarize', {
    method: 'POST',
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({content: transcriptElement.value})
  })

  const content = await response.json()
  
  summarizeElement.value = content.content
 
  // Change button state
  summarizeButton.removeChild(summarizeButton.firstElementChild)
  summarizeButton.removeChild(summarizeButton.firstElementChild)
  span = document.createElement('span')
  span.className = "sr-only"
  span.innerHTML = "Summarize"
  summarizeButton.appendChild(span)

  
}

const getMicrophone = async () => {
  const userMedia = await navigator.mediaDevices.getUserMedia({
    audio: {deviceId: selectedDevice},
  });

  return new MediaRecorder(userMedia);
}

const openMicrophone = async (microphone, socket) => {
  await microphone.start(500)

  microphone.onstart = () => {
    console.log("client: microphone opened")
    document.body.classList.add("recording")
  }

  microphone.onstop = () => {
    console.log("client: microphone closed")
    document.body.classList.remove("recording")
  }

  microphone.ondataavailable = (e) => {
    const data = e.data
    console.log("client: sent data to websocket")
    socket.send(data)
  }
}

const closeMicrophone = async (microphone) => {
  microphone.stop()
}

const start = async (socket) => {
  const listenButton = document.getElementById("record")
  let microphone

  console.log("client: waiting to open microphone")

  listenButton.addEventListener("click", async () => {
    if (!microphone) {
      // open and close the microphone
      microphone = await getMicrophone()
      await openMicrophone(microphone, socket)
    } else {
      await closeMicrophone(microphone)
      microphone = undefined
    }
  })
}

const getApiKey = async () => {
  const result = await fetch("/key")
  const key = await result.json()

  return key
}

window.addEventListener("load", async () => {

  await getDevices()

  const key = await getApiKey()

  const { createClient } = deepgram
  const _deepgram = createClient(key)

  const socket = _deepgram.listen.live({ diarize: true, model: "nova-2", smart_format: true })

  socket.on("open", async () => {
    console.log("client: connected to websocket")

    socket.on("Results", (data) => {

      const transcript = data.channel.alternatives[0].transcript

      if (transcript !== "")
        transcriptElement.value += transcript + ' '
    })

    socket.on("error", (e) => console.error(e))

    socket.on("warning", (e) => console.warn(e))

    socket.on("Metadata", (e) => console.log(e))

    socket.on("close", (e) => console.log(e))

    await start(socket)
  })
})
