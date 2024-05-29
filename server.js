const express = require("express")
const http = require("http")
const https = require("https")
const fs = require("fs")
const { createClient } = require("@deepgram/sdk")
const OpenAI = require('openai')
const dotenv = require("dotenv")
const bodyParser = require("body-parser")
dotenv.config()

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

server.listen(process.env.PORT, () => {
  console.log('listening on http://localhost:' + process.env.PORT)
})
