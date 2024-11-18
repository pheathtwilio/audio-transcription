const express = require("express")
const http = require("http")
const https = require("https")
const fs = require("fs")
const { createClient } = require("@deepgram/sdk")
const OpenAI = require('openai')
const dotenv = require("dotenv")
const bodyParser = require("body-parser")
dotenv.config()

const Airtable = require('airtable')

const client = createClient(process.env.DEEPGRAM_API_KEY)

const app = express()
const server = http.createServer(app)

const options = {
  key: fs.readFileSync("./ssl/rootCA.key"),
  cert: fs.readFileSync("./ssl/rootCA.crt")
}

const secureServer = https.createServer(options, app)

app.use(express.static("public/"))
app.use(bodyParser.json())
app.get("/", (req, res) => {
  res.sendFile(__dirname + "/public/index.html")
})

const getApiKey = async () => {
  return process.env.DEEPGRAM_API_KEY
}

app.get("/key", async (req, res) => {
  res.json(process.env.DEEPGRAM_API_KEY)
})

const summarize = async (content) => {

  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY, // This is the default and can be omitted
  })

  const completion = await openai.chat.completions.create({
    messages: [
      {
        role: "system",
        content: "Your role is to summarize this transcription of a meeting into concise points labeled NOW, NEXT STEPS and RISK. Identify any risk within the transcript and add it to the appropriate point and respond in json format.",
      },
      { role: "user", content: content },
    ],
    model: "gpt-4o",
    response_format: { type: "json_object" },
  })

  return completion.choices[0].message.content
}

app.post("/summarize", async (req, res) => {  
  const content = await summarize(req.body.content)

  const response = {
    content: "NOW: " + JSON.parse(content).NOW + " NEXT STEPS: " + JSON.parse(content).NEXT_STEPS + " RISK: " + JSON.parse(content).RISK
  }

  console.log(response)

  res.json(response)
})

const summarizeGeneral = async (content) => {

  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY, // This is the default and can be omitted
  })

  const completion = await openai.chat.completions.create({
    messages: [
      {
        role: "system",
        content: [{ "type": "text", "text" : "Your role is to summarize this transcription of a meeting and to generalize what happened at the beginning, middle and end. Ensure to respond with key points that happened during the discussion. And any action items are noted at the end. Respond in json format."}]
      },
      { 
        role: "user",
        content: [{ "type": "text", "text":content}]
      },
    ],
    model: "gpt-4o",
    response_format: { type: "json_object" },
  })

  return completion.choices[0].message.content
}

app.post("/summarizeGeneral", async (req, res) => {  
  const content = await summarizeGeneral(req.body.content)
  const parsedContent = JSON.parse(content)
  let responseContent = ""

  for (const key in JSON.parse(content)){
  
    responseContent += key.toString().toUpperCase() + "\n"

    // if obj has inner obj
    if(typeof parsedContent[key] === 'object'){
      let innerObject = parsedContent[key]
      for(const childKey in innerObject){
        // if innerObj jas another innerObj
        if(typeof innerObject[childKey] === 'object'){
          let grandChildObject = innerObject[childKey]
          for(const grandChildKey in grandChildObject){
            responseContent += grandChildKey.toString().toUpperCase() + ": " + grandChildObject[grandChildKey] + " "
          }
        }else{
          responseContent += childKey.toString().toUpperCase() + ": " + innerObject[childKey] + " "
        }
      }
      responseContent += "\n\n"
    }
  }

  res.json({ content: responseContent })
})

const cleanup = async () => {

  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY, // This is the default and can be omitted
  })

  const completion = await openai.chat.completions.create({
    messages: [
      { 
        role: "user",
        content: [{ "type": "text", "text":"Forget everything we talked about and prepare for new content"}]
      },
    ],
    model: "gpt-4o",
  })

}

const sendToAirtable = async (transcription, summary) => {

  const base = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY }).base(process.env.AIRTABLE_BASE_ID)

  try{

    const record = await base(process.env.AIRTABLE_TABLE_NAME).create({
      "Transcription":transcription,
      "Summary":summary
    })

    return record

  }catch(err){

    console.error(err)

  }

}

app.post("/sendToAirtable", async (req, res) => {  
  
  const record = await sendToAirtable(req.body.transcription, req.body.summary)

  cleanup()

  res.json({ record: record})
  
})



server.listen(process.env.PORT, () => {
  console.log('listening on http://localhost:' + process.env.PORT)
})
