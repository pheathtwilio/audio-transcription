const express = require("express");
const http = require("http");
const https = require("https")
const fs = require("fs")
const { createClient } = require("@deepgram/sdk");
const dotenv = require("dotenv");
dotenv.config();

const client = createClient(process.env.DEEPGRAM_API_KEY);

const app = express();
const server = http.createServer(app);

const options = {
  key: fs.readFileSync("./ssl/rootCA.key"),
  cert: fs.readFileSync("./ssl/rootCA.crt")
}

const secureServer = https.createServer(options, app)

app.use(express.static("public/"));
app.get("/", (req, res) => {
  res.sendFile(__dirname + "/public/index.html");
});

const getProjectId = async () => {
  const { result, error } = await client.manage.getProjects();

  if (error) {
    throw error;
  }

  return result.projects[0].project_id;
};

const getTempApiKey = async (projectId) => {
  const { result, error } = await client.manage.createProjectKey(projectId, {
    comment: "short lived",
    scopes: ["usage:write"],
    time_to_live_in_seconds: 20,
  });

  if (error) {
    throw error;
  }

  return result;
};

const getApiKey = async () => {
  return process.env.DEEPGRAM_API_KEY
}

app.get("/key", async (req, res) => {
  // const projectId = await getProjectId();
  // const key = await getTempApiKey(projectId);

  // console.log(key)

  res.json(process.env.DEEPGRAM_API_KEY);
});

server.listen(process.env.PORT, () => {
  console.log('listening on http://localhost:' + process.env.PORT);
 
});

// secureServer.listen(process.env.SECURE_PORT, () => {
//   console.log('listening on https://localhost:' + process.env.SECURE_PORT)
// })
