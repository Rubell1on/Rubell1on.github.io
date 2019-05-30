const express = require('express');
const utils = require('./JS/utils');
const gOAuth = require('./JS/gOAuth');
const bodyParser = require('body-parser');
const {google} = require('googleapis');

const {creds, token, SPREADSHEET_ID} = utils.getEnvironment(process.env);

const oAuth2Client = new google.auth.OAuth2(creds.web.client_id, creds.web.client_secret, creds.web.redirect_uris);
oAuth2Client.setCredentials(token);

const PORT = process.env.PORT || 3000;
let schedules = {};

app = express();

utils.parseSchedule()
    .then((data) => {
        schedules = data;
        app.listen(PORT, () => {
            console.log(`Сервер запущен и ожидает запросы по ${PORT}`);
            setInterval(() => {
                utils.refreshPage().catch(e => console.log(e));
            }, 300000);
        });
    })
    .catch(err => console.error(err));

app.set('view engine', 'ejs');
app.use('/public', express.static('public'));
app.use('/JS', express.static('JS'));
app.use('/pics', express.static('pics'));
app.use('/feedback', express.static('feedback'));
app.use(bodyParser.urlencoded({extended: false}));

app.get('/', (req, res) => {
    res.render("login.ejs");
});

app.get('/schedule', (req, res) => {
    const groupName = req.query.group.toUpperCase();
    const current = req.query.current;
    if (schedules.hasOwnProperty(groupName)) {
        const {currWeek, currentDay, currStudyWeekNum} = utils.getDateParams();
        const filteredSchedule = utils.filterPairsByWeek(schedules[groupName], currStudyWeekNum);
        if (current) {
            if (filteredSchedule[currWeek] && Object.keys(filteredSchedule[currWeek][currentDay]) != false) {
                const currSchedule = {};
                currSchedule[currWeek] = {};
                currSchedule[currWeek][currentDay] = filteredSchedule[currWeek][currentDay];
                res.render('index.ejs', {schedule: currSchedule, groupName});
            } else {
                res.render('index.ejs', {schedule: undefined, groupName});
            }
        } else res.render('index.ejs', {schedule: filteredSchedule, groupName});
    } else res.send(`Расписание группы ${groupName} не найдено!`);
});

app.get('/schedule/api', (req, res) => {
    const query = req.query;
    const queryKeys = Object.keys(query);
    const {currWeek, currentDay, currStudyWeekNum} = utils.getDateParams();
    if (!queryKeys.length) res.json(schedules);
    else {
        if (query.hasOwnProperty('group')) {
            const groupName = query.group.toUpperCase();
            if (schedules.hasOwnProperty(groupName)) {
                let groupSched = schedules[groupName];
                if (query.filtered) groupSched = utils.filterPairsByWeek(groupSched, currStudyWeekNum);
                if (query.hasOwnProperty('current')) {
                    if (groupSched[currWeek] && Object.keys(groupSched[currWeek][currentDay]) != false) {
                        const currSchedule = {};
                        currSchedule[currWeek] = {};
                        currSchedule[currWeek][currentDay] = groupSched[currWeek][currentDay];
                        res.json({schedule: currSchedule, groupName});
                    } else {
                        res.json({schedule: undefined, groupName});
                    }
                }
                res.json({schedule: groupSched, groupName});
                
            } else {
                res.status(404).send(`Расписание группы ${groupName} не найдено!`);
            } 
        }
    }
});

app.route('/feedback')
    .get(async (req, res) => {
        const feedback = await gOAuth.getSpreadSheet(oAuth2Client, SPREADSHEET_ID).catch(err => console.log(err));
        if (req.query.json) {
            res.json(feedback);
        } else {
            res.render('feedback.ejs');
        }
    })
    .post((req, res) => postFeedback(req, res).catch(err => console.log(err)));

app.get('/update', (req, res) => {
    res.write('Обновление расписаний началось');
    res.end('200');
});

app.get('/test', (req, res) => {
    const render = req.query.render;
    res.render(render);
});

async function postFeedback(req, res) {
    if (req.body.message) {
        const text = req.body.message;
        const timestamp = req.body.timestamp.replace(/, /g, 'T');
        const rate = req.body.count;
        await gOAuth.appendSpreadSheet(oAuth2Client, SPREADSHEET_ID, [text, timestamp, rate], 'A1');
        res.status(201).send('Фидбек отправлен! Спасибо;)');
    } else {
        res.status(400).send('Произошла серверная ошибка');
    }
}

