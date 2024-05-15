const captions = window.document.getElementById("captions")
let selectedDevice = 'default'
const selectDeviceElement = window.document.getElementById("selectDevice")

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

const getTempApiKey = async () => {
  const result = await fetch("/key")
  const json = await result.json()

  return json.key
}

window.addEventListener("load", async () => {

  await getDevices()

  const key = await getTempApiKey()

  const { createClient } = deepgram
  const _deepgram = createClient(key)

  const socket = _deepgram.listen.live({ model: "nova-2", smart_format: true })

  socket.on("open", async () => {
    console.log("client: connected to websocket")

    socket.on("Results", (data) => {
      console.log(data)

      const transcript = data.channel.alternatives[0].transcript

      if (transcript !== "")
        captions.innerHTML = transcript ? `<span>${transcript}</span>` : "";
    })

    socket.on("error", (e) => console.error(e))

    socket.on("warning", (e) => console.warn(e))

    socket.on("Metadata", (e) => console.log(e))

    socket.on("close", (e) => console.log(e))

    await start(socket)
  })
})
