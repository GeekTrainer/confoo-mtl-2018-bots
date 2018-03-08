import * as restify from 'restify';
import * as builder from 'botbuilder';
import * as request from 'request-promise-native';
import { METHODS } from 'http';

// web server
const server = restify.createServer();
server.listen(3978, () => console.log("server up!!"));

// connector
const connector = new builder.ChatConnector();
server.post('/api/messages', connector.listen());

// bot
const bot = new builder.UniversalBot(
    connector,
    [
        (session) => {
            session.sendTyping();
            const qnaUrl = 'https://westus.api.cognitive.microsoft.com/qnamaker/v2.0/knowledgebases/4096e3a9-881a-430c-b762-d3ff10ee80fe/generateAnswer';
            const headers = {
                'Ocp-Apim-Subscription-Key': '64ac1b5c620f4a4bafbec15192bf284a'
            }
            request(qnaUrl, {
                body: JSON.stringify({question: session.message.text}),
                headers: headers,
                method: "POST"
            }).then((response) => {
                const answers = JSON.parse(response).answers;
                const firstAnswer = answers[0];
                if(firstAnswer.score > 50) {
                    session.send(firstAnswer.answer);
                    builder.Prompts.confirm(session, 'Did this help?');
                } else {
                    session.endConversation("Sorry, I don't know the answer to that. You can ask another question, or report a lost runner.")
                }
            })
        }
    ]
);

bot.recognizer(new builder.LuisRecognizer("https://westus.api.cognitive.microsoft.com/luis/v2.0/apps/80f76c50-d904-41f4-bddf-c59ae0596d83?subscription-key=87c43bd5f3b24ec2b5d08757039da547&verbose=true&timezoneOffset=0&q="));

bot.dialog('lost-runner', [
    (session, args, next) => {
        const locationEntity = builder.EntityRecognizer.findEntity(args.entities, 'location');
        if(!locationEntity)
            builder.Prompts.text(session, "Where did you lose your runner?");
        else
            next({response: locationEntity.entity});
    },
    (session, results) => {
        const location = results.response;
        session.endConversation(`We will keep an eye out near ${location}`)
    }
])
.triggerAction({
    matches: 'lost-runner'
})