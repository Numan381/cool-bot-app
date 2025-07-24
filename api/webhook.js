const jwt = require('jsonwebtoken');
const fs = require('fs');
const requestp = require('request-promise');

const APP_ID = '1652933'; 
const PRIVATE_KEY = fs.readFileSync('./cool-bot-app.private-key.pem', 'utf8');
const regex = /\[gifbot:(.*?)\]/i;

const generateJWT = () => jwt.sign(
  { iss: APP_ID },
  PRIVATE_KEY,
  { algorithm: 'RS256', expiresIn: '10m' }
);

const getInstallationToken = async (installationId) => {
  const jwtToken = generateJWT();
  const res = await requestp({
    method: 'POST',
    url: `https://api.github.com/app/installations/${installationId}/access_tokens`,
    headers: {
      Authorization: `Bearer ${jwtToken}`,
      Accept: 'application/vnd.github+json',
      'User-Agent': 'cool-bot-app'
    },
    json: true
  });
  return res.token;
};

const searchGifs = (term) => requestp({
  url: 'http://api.giphy.com/v1/gifs/search',
  qs: {
    q: term,
    api_key: 'dc6zaTOxFJmzC'
  },
  json: true
});

const postComment = (url, body, token) => requestp({
  method: 'POST',
  url,
  body: { body },
  headers: {
    Authorization: `token ${token}`,
    'User-Agent': 'cool-bot-app'
  },
  json: true
});

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).send('Method Not Allowed');
  }

  const body = req.body;

  if (body.action !== 'created' || !body.comment || !body.installation) {
    return res.status(200).send('Event ignored');
  }

  const match = regex.exec(body.comment.body);
  if (!match) {
    return res.status(200).send('No gifbot keyword');
  }

  const searchTerm = match[1];
  try {
    const gifResults = await searchGifs(searchTerm);
    const gifUrl = gifResults.data[0].images.fixed_height.url;
    const commentBody = `![${searchTerm}](${gifUrl})`;

    const token = await getInstallationToken(body.installation.id);
    await postComment(body.issue.comments_url, commentBody, token);

    return res.status(200).send('GIF posted');
  } catch (err) {
    console.error(err);
    return res.status(500).send('Error occurred');
  }
};
