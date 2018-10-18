import { module } from 'angular';
import * as _ from 'lodash';
import EventEmitter from 'wolfy87-eventemitter';

import { nest } from 'd3';


const loadJson = filePath => {
    const data = require(filePath);
    return data;
};


const allEvents = require('./player_interactions.json');
const allMarkers = require('./sessions_markers.json');
const allEmotions = require('./sessions_emotions.json');
const allSessionsInfo = require('./sessions_info.json');

let emotionsData = [];
_.each(allEmotions, (dataset, coach) => {
    _.each(dataset, (emotions, key) => {
        emotionsData.push({ sessionid: _.split(key, '-')[1], emotions })
    })
});

export default module('app.emodashDataService', []).service('EmodashDataService', [
    '$translate',
    function ($translate) {
        function EmodashDataService() {
            let self = this;

            this.options = {
                yaxis: {
                    dataset: 'dataset0',
                    key: 'val_0',
                    color: { key: 'color' },
                    label: { key: 'label' },
                },
            };

            this.balanceChartDataOptions = _.extend({}, this.options, {
                width: 100,
                barHeight: 70,
                rOffset: 30,
            });
            this.radialColChartDataOptions = _.extend({}, this.options, { width: 260 });

            var htmlRootEmotionLabel = 'emodash.html.label.';
            this.emotionsMetadata = {
                fear: {
                    color: '#AA00FF',
                    label: 'fear',
                },
                sadness: {
                    color: '#00B8D4',
                    label: 'sadness',
                },
                happiness: {
                    color: '#64DD17',
                    label: 'happiness',
                },
                surprise: {
                    color: '#FFAB00',
                    label: 'surprise',
                },
                neutral: {
                    color: '#2962FF',
                    label: 'neutral',
                },
                anger: {
                    color: '#D50000',
                    label: 'anger',
                },
                disgust: {
                    color: '#212121',
                    label: 'disgust',
                },
                contempt: {
                    color: '#006064',
                    label: 'contempt',
                },
                frustration: {
                    color: '#D50000',
                    label: 'frustration',
                },
                negative: {
                    color: '#D50000',
                    label: 'negative',
                },
                positive: {
                    color: '#64DD17',
                    label: 'positive',
                },
            };

            this.radialColChartData1 = _.extend(new EventEmitter(), {
                dataset0: [
                    { x: 0, val_0: 50, color: '#35a993', label: 'negative' },
                    { x: 1, val_0: 70, color: '#005b9d', label: 'positive' },
                ],
            });

            this.radialColChartData2 = {
                dataset0: [
                    { x: 0, val_0: 35, color: '#35a993', label: 'label1' },
                    { x: 1, val_0: 29, color: '#005b9d', label: 'label2' },
                    { x: 2, val_0: 89, color: '#9541c8', label: 'label3' },
                ],
            };

            this.radialColChartData3 = {
                dataset0: [
                    { x: 0, val_0: 1, color: '#005b9d', label: 'label1' },
                    { x: 1, val_0: 10, color: '#005b9d', label: 'label2' },
                    { x: 2, val_0: 20, color: '#51b6c9', label: 'label3' },
                    { x: 3, val_0: 30, color: '#51addf', label: 'label4' },
                    { x: 4, val_0: 40, color: '#e0765a', label: 'label5' },
                    { x: 5, val_0: 50, color: '#dcc96b', label: 'label6' },
                    { x: 6, val_0: 80, color: '#35a993', label: 'label7' },
                    { x: 7, val_0: 100, color: '#9541c8', label: 'label8' },
                ],
            };

            this.radialColChartData4 = {
                dataset0: [
                    { x: 0, val_0: 1, color: '#005b9d', label: 'label1' },
                    { x: 1, val_0: 10, color: '#005b9d', label: 'label2' },
                    { x: 2, val_0: 20, color: '#51b6c9', label: 'label3' },
                    { x: 3, val_0: 30, color: '#51addf', label: 'label4' },
                    { x: 4, val_0: 40, color: '#e0765a', label: 'label5' },
                    { x: 5, val_0: 50, color: '#dcc96b', label: 'label6' },
                    { x: 6, val_0: 80, color: '#35a993', label: 'label7' },
                    { x: 7, val_0: 100, color: '#9541c8', label: 'label8' },
                    { x: 5, val_0: 50, color: '#dcc96b', label: 'label9' },
                    { x: 6, val_0: 33, color: '#35a993', label: 'label10' },
                    { x: 7, val_0: 67, color: '#9541c8', label: 'label11' },
                    { x: 5, val_0: 50, color: '#dcc96b', label: 'label12' },
                    { x: 6, val_0: 5, color: '#35a993', label: 'label13' },
                    { x: 7, val_0: 2, color: '#9541c8', label: 'label14' },
                ],
            };

            this.DATASET_SIZE = 100;
            this.sessionsTlData = {
                'dataset-5685e75cd2228350dea22e31-1456055190240-100': Array.from(
                    { length: this.DATASET_SIZE },
                    function (v, k) {
                        return {
                            x: k,
                            timestamp: k,
                            positive: Math.floor(Math.random() * 70),
                            negative: Math.floor(Math.random() * 35),
                        };
                    },
                ),
                'dataset-5685e75cd2228350dea22e32-1456055190240-100': Array.from(
                    { length: this.DATASET_SIZE },
                    function (v, k) {
                        return {
                            x: k,
                            timestamp: k,
                            positive: Math.floor(Math.random() * 55),
                            negative: Math.floor(Math.random() * 43),
                        };
                    },
                ),
                'dataset-5685e75cd2228350dea22e33-1456055190240-100': Array.from(
                    { length: this.DATASET_SIZE },
                    function (v, k) {
                        return {
                            x: k,
                            timestamp: k,
                            positive: Math.floor(Math.random() * 70),
                            negative: Math.floor(Math.random() * 27),
                        };
                    },
                ),
                'dataset-5685e75cd2228350dea22e34-1456055190240-100': Array.from(
                    { length: this.DATASET_SIZE },
                    function (v, k) {
                        return {
                            x: k,
                            timestamp: k,
                            positive: Math.floor(Math.random() * 60),
                            negative: Math.floor(Math.random() * 27),
                        };
                    },
                ),
                'dataset-5685e75cd2228350dea22e35-1456055190240-100': Array.from(
                    { length: this.DATASET_SIZE },
                    function (v, k) {
                        return {
                            x: k,
                            timestamp: k,
                            positive: Math.floor(Math.random() * 60),
                            negative: Math.floor(Math.random() * 27),
                        };
                    },
                ),
                'dataset-5685e75cd2228350dea22e36-1456055190240-100': Array.from(
                    { length: this.DATASET_SIZE },
                    function (v, k) {
                        return {
                            x: k,
                            timestamp: k,
                            positive: Math.floor(Math.random() * 60),
                            negative: Math.floor(Math.random() * 27),
                        };
                    },
                ),
                'dataset-5685e75cd2228350dea22e37-1456055190240-100': Array.from(
                    { length: this.DATASET_SIZE },
                    function (v, k) {
                        return {
                            x: k,
                            timestamp: k,
                            positive: Math.floor(Math.random() * 60),
                            negative: Math.floor(Math.random() * 27),
                        };
                    },
                ),
                'dataset-5685e75cd2228350dea22e38-1456055190240-100': Array.from(
                    { length: this.DATASET_SIZE },
                    function (v, k) {
                        return {
                            x: k,
                            timestamp: k,
                            positive: Math.floor(Math.random() * 60),
                            negative: Math.floor(Math.random() * 27),
                        };
                    },
                ),
                'dataset-5685e75cd2228350dea22e39-1456055190240-100': Array.from(
                    { length: this.DATASET_SIZE },
                    function (v, k) {
                        return {
                            x: k,
                            timestamp: k,
                            positive: Math.floor(Math.random() * 60),
                            negative: Math.floor(Math.random() * 27),
                        };
                    },
                ),
                'dataset-5685e75cd2228350dea22e10-1456055190240-100': Array.from(
                    { length: this.DATASET_SIZE },
                    function (v, k) {
                        return {
                            x: k,
                            timestamp: k,
                            positive: Math.floor(Math.random() * 60),
                            negative: Math.floor(Math.random() * 27),
                        };
                    },
                ),
                'dataset-5685e75cd2228350dea22b31-1456055190240-100': Array.from(
                    { length: this.DATASET_SIZE },
                    function (v, k) {
                        return {
                            x: k,
                            timestamp: k,
                            positive: Math.floor(Math.random() * 70),
                            negative: Math.floor(Math.random() * 35),
                        };
                    },
                ),
                'dataset-5685e75cd2228350dea22b32-1456055190240-100': Array.from(
                    { length: this.DATASET_SIZE },
                    function (v, k) {
                        return {
                            x: k,
                            timestamp: k,
                            positive: Math.floor(Math.random() * 55),
                            negative: Math.floor(Math.random() * 43),
                        };
                    },
                ),

            };

            this.emodashDataApi = {

                getDocS3URL: function (docId) {
                    return { $promise: Promise.resolve({ file: { s3: { url: 'assets/generic.pdf' }, displayType: 'pdf' } }) };
                },
                getEmodashInfo: function (params) {
                    return { $promise: Promise.resolve({}) };
                },
                getClosedSessionsInfo: function ({ coachName = "david" }) {
                    const sessionsInfo = _.get(allSessionsInfo, coachName);

                    return {
                        $promise: Promise.resolve(sessionsInfo)
                    };
                },
                getEmodashEmotionsMeans: function (params) {
                    return {
                        $promise: Promise.resolve({
                            means: {
                                surprise: 2.31,
                                sadness: 5.45,
                                happiness: 21.25,
                                fear: 0.42,
                                disgust: 0.3,
                                contempt: 0.55,
                                anger: 0.45,
                                neutral: 69.26,
                            },
                            objective: 'english, professional, interview',
                        }),
                    };
                },
                getShartedDocsBySessionId: function ({ sessionId }) {
                    const data = {
                        '5a0bfe9bb2ee7900015fcd38': [
                            {
                                stop: 1799, docid: "5a0c1cb6b2ee7900015fcd45", doctype: "pdf", start: 1073
                            }
                        ],
                        '5a0bfe9bb2ee7900015fcd3a': [
                            {
                                stop: 626, docid: "5a0c1cb6b2ee7900015fcd45", doctype: "pdf", start: 420
                            },
                            {
                                stop: 1581, docid: "5a0c1cb6b2ee7900015fcd45", doctype: "pdf", start: 626
                            },
                            {
                                stop: 1799, docid: "5a0c1cb6b2ee7900015fcd45", doctype: "pdf", start: 1581
                            }
                        ],
                        '5a0bfe9bb2ee7900015fcd3b': [
                            {
                                stop: 965, docid: "5a0c1cb6b2ee7900015fcd45", doctype: "pdf", start: 69
                            },
                            {
                                stop: 1799, docid: "5a0c1cb6b2ee7900015fcd45", doctype: "pdf", start: 965
                            }
                        ],
                        '5a0bfe9bb2ee7900015fcd3c': [
                            {
                                stop: 1800, docid: "5a0c1cb6b2ee7900015fcd45", doctype: "pdf", start: 43
                            }
                        ],
                        '5a0bfe9bb2ee7900015fcd3d': [
                            {
                                stop: 1301, docid: "5a0c1cb6b2ee7900015fcd45", doctype: "pdf", start: 182
                            },
                            {
                                stop: 1800, docid: "5a0c1cb6b2ee7900015fcd45", doctype: "pdf", start: 1328
                            }
                        ]
                    };
                    return {
                        $promise: Promise.resolve([
                            {
                                stop: 1799, docid: "5a0c1cb6b2ee7900015fcd45", doctype: "pdf", start: 1073
                            }
                        ])
                    };
                },
                getChatMessagesBySessionId: function ({ sessionId }) {
                    const data = {
                        '5a0bfe9bb2ee7900015fcd3d': [
                            {
                                message: "Dalian", author: "5a0417250d91d8264de60c28", recipient: "5a0abfda8bb30500015a1186", time_from_start: 268
                            },
                            {
                                message: "part time", author: "5a0417250d91d8264de60c28", recipient: "5a0abfda8bb30500015a1186", time_from_start: 876
                            },
                            {
                                message: "hello there", author: "5a0417250d91d8264de60c28", recipient: "5a0abfda8bb30500015a1186", time_from_start: 100
                            }
                        ],
                        '5a0bfe9bb2ee7900015fcd3c': [
                            {
                                message: "do you hear me", author: "5a0417250d91d8264de60c28", recipient: "5a0abfda8bb30500015a1186", time_from_start: 45
                            },
                            {
                                message: "yeh do u", recipient: "5a0417250d91d8264de60c28", author: "5a0abfda8bb30500015a1186", time_from_start: 55
                            },
                            {
                                message: "Building something", author: "5a0417250d91d8264de60c28", recipient: "5a0abfda8bb30500015a1186", time_from_start: 1000
                            }
                        ],
                        '5a0bfe9bb2ee7900015fcd3b': [
                            {
                                message: "Right after", author: "5a0417250d91d8264de60c28", recipient: "5a0abfda8bb30500015a1186", time_from_start: 500
                            },
                            {
                                message: "Okay got it", recipient: "5a0417250d91d8264de60c28", author: "5a0abfda8bb30500015a1186", time_from_start: 505
                            },
                            {
                                message: "we are live", author: "5a0417250d91d8264de60c28", recipient: "5a0abfda8bb30500015a1186", time_from_start: 45
                            }
                        ],
                        '5a0bfe9bb2ee7900015fcd3a': [
                            {
                                message: "Hi.. live", author: "5a0417250d91d8264de60c28", recipient: "5a0abfda8bb30500015a1186", time_from_start: 10
                            },
                            {
                                message: "Yup :)", recipient: "5a0417250d91d8264de60c28", author: "5a0abfda8bb30500015a1186", time_from_start: 15
                            },
                            {
                                message: "See u soon", author: "5a0417250d91d8264de60c28", recipient: "5a0abfda8bb30500015a1186", time_from_start: 1795
                            }
                        ],
                        '5a0bfe9bb2ee7900015fcd38': [
                            {
                                message: "Justification", author: "5a0417250d91d8264de60c28", recipient: "5a0abfda8bb30500015a1186", time_from_start: 199
                            },
                            {
                                message: "the run of something..", author: "5a0417250d91d8264de60c28", recipient: "5a0abfda8bb30500015a1186", time_from_start: 456
                            }
                        ]
                    };
                    return {
                        $promise: Promise.resolve([
                            {
                                message: "Dalian", author: "5a0417250d91d8264de60c28", recipient: "5a0abfda8bb30500015a1186", time_from_start: 268
                            },
                            {
                                message: "part time", author: "5a0417250d91d8264de60c28", recipient: "5a0abfda8bb30500015a1186", time_from_start: 876
                            },
                            {
                                message: "hello there", author: "5a0417250d91d8264de60c28", recipient: "5a0abfda8bb30500015a1186", time_from_start: 100
                            }
                        ])
                    }
                },
                getEmodashReport: function (params) {
                    return {
                        $promise: Promise.resolve({
                            video: './assets/out.mp4', sp_session: {
                                "_id": "5a0bfe9bb2ee7900015fcd38",
                                "status": "3_Closed",
                                "pack": "5a0b58118bb30500015a12ba",
                                "packIndex": 0,
                                "type": "normal",
                                "report_fields": {
                                    "synthesis": "It was a pleasure to meet you, Annalise and to learn of your future plans! I thought your grammar was excellent, as was your fluency. We can make improvements and I look forward to more in the future!",
                                    "instructions": "I'd like to learn a lot more about you and to try some role play scenarios. I believe that success in interviews is attributable to practice and confidence. I will want you to 'blow your own trumpet' and start to examine why you are the perfect candidate for any job that you apply for :-\nI look forward to seeing you soon!",
                                    "read": "2017-11-16T21:42:58.522+0000"
                                },
                                "room_fields": {
                                    "openTokSession": "2_MX40NTY4NTcxMn5-MTUxMDc1NDMxMDU3M35PQmh1UmpQZVY3eGloT2FxcUhyZ2RKVFZ-fg",
                                    "started": "2017-11-15T13:58:33.707+0000",
                                    "finished": "2017-11-15T14:30:39.038+0000",
                                    "abTesting": {
                                        "isEmodash": true,
                                        "isEmotion": true,
                                        "emotionsJob": {
                                            "created": "2017-11-15T15:27:33.258+0000",
                                            "isEmotionsJobDone": true
                                        }
                                    },
                                    "video": {
                                        "created": "2017-11-15T14:54:24.976+0000",
                                        "s3": {
                                            "key": "5a0bfe9bb2ee7900015fcd38/videos/composited.mp4",
                                            "url": "http://localhost:3000/api/v1/data-manager/buckets/sessions/5a0bfe9bb2ee7900015fcd38/videos/composited.mp4",
                                            "urlExpiration": "2018-05-15T21:58:15.679+0000"
                                        }
                                    },
                                    "audio": {
                                        "mixed": {
                                            "created": "2017-11-15T14:34:42.342+0000",
                                            "s3": {
                                                "key": "5a0bfe9bb2ee7900015fcd38/records/mono.ogg",
                                                "url": "http://localhost:3000/api/v1/data-manager/buckets/sessions/5a0bfe9bb2ee7900015fcd38/records/mono.ogg",
                                                "urlExpiration": "2018-05-15T21:58:15.644+0000"
                                            }
                                        }
                                    },
                                    "durations": {
                                        "opening": 120,
                                        "running": 1800,
                                        "closing": 180
                                    }
                                },
                                "prepared": true,
                                "markers": [
                                    {
                                        "type": "negative",
                                        "start": 313,
                                        "stop": 323,
                                        "_id": "5a0c49c5b2ee7900015fcec1",
                                        "selected": true,
                                        "learner_text": "Grammar: 'If your are an English speaker...'\n'If your spoken English is good.....'",
                                        "quick_text": "",
                                        "original_data": {
                                            "type": "negative",
                                            "offset": 318,
                                            "start": 313,
                                            "stop": 323,
                                            "client_time": "2017-11-15T14:05:56.332+0000",
                                            "server_time_for_client": "2017-11-15T14:05:57.395+0000",
                                            "server_time_save": "2017-11-15T14:05:57.434+0000"
                                        }
                                    },
                                    {
                                        "type": "negative",
                                        "start": 631,
                                        "stop": 641,
                                        "_id": "5a0c4b03b2ee7900015fcec5",
                                        "selected": false,
                                        "learner_text": "",
                                        "quick_text": "",
                                        "original_data": {
                                            "type": "negative",
                                            "offset": 635,
                                            "start": 630,
                                            "stop": 640,
                                            "client_time": "2017-11-15T14:11:14.061+0000",
                                            "server_time_for_client": "2017-11-15T14:11:15.122+0000",
                                            "server_time_save": "2017-11-15T14:11:15.149+0000"
                                        }
                                    },
                                    {
                                        "type": "negative",
                                        "start": 704,
                                        "stop": 714,
                                        "_id": "5a0c4b4cb2ee7900015fceca",
                                        "selected": true,
                                        "learner_text": "Grammar: (passive 'If I am chosen....' / 'If I am selected /  if I am given the opportunity /",
                                        "quick_text": "",
                                        "original_data": {
                                            "type": "negative",
                                            "offset": 709,
                                            "start": 704,
                                            "stop": 714,
                                            "client_time": "2017-11-15T14:12:27.886+0000",
                                            "server_time_for_client": "2017-11-15T14:12:28.947+0000",
                                            "server_time_save": "2017-11-15T14:12:28.975+0000"
                                        }
                                    },
                                    {
                                        "type": "negative",
                                        "start": 803,
                                        "stop": 813,
                                        "_id": "5a0c4bafb2ee7900015fcecb",
                                        "selected": true,
                                        "learner_text": "Pronunciation: not 'monthes' (thes but 'months' (ths\nPlease practice: months, clothes, paths, baths, maths",
                                        "quick_text": "",
                                        "original_data": {
                                            "type": "negative",
                                            "offset": 808,
                                            "start": 803,
                                            "stop": 813,
                                            "client_time": "2017-11-15T14:14:06.797+0000",
                                            "server_time_for_client": "2017-11-15T14:14:07.858+0000",
                                            "server_time_save": "2017-11-15T14:14:07.884+0000"
                                        }
                                    }
                                ],
                                "activities": [
                                    "5a0c1c1bb2ee7900015fcd43",
                                    "5a0c1ca9b2ee7900015fcd44"
                                ],
                                "objective": "Needs Analysis: introductions, language level and schedules",
                                "created": "2017-11-15T08:45:15.502+0000",
                                "__v": 6,
                                "calendarId": "7jvfa590j716go3gjn3kod5dko"
                            }
                        })
                    }
                },
                getEmodashMarkers: function ({ sessionId }) {
                    const marker = _.find(allMarkers, { _id: sessionId });

                    return {
                        $promise: Promise.resolve(marker.markers),
                    }
                },
                getEmodashEmotionsData: function ({ coachName = 'david' }) {
                    const emotion = _.get(allEmotions, coachName)

                    return {
                        $promise: Promise.resolve(emotion),
                    };
                },
                getPlayerEventsData: function ({ sessionId }) {

                    let events = _.filter(allEvents, { sessionid: sessionId, action: 'seeked' })

                    _.each(events, item => {
                        item.currenttime = _.round(+item.currenttime, 0);
                    });

                    // markers
                    const markers = _.get(_.find(allMarkers, { _id: sessionId }), 'markers');
                    const markersStarts = _.map(markers, 'obj.start');

                    events = _.filter(events, event => (_.indexOf(markersStarts, event.currenttime) === -1));

                    events = _.groupBy(events, 'currenttime');

                    events = _.map(events, (value, key) => {
                        return {
                            startkey: +key,
                            stopkey: +key,
                            ystartkey: 0,
                            ystopkey: _.size(value),
                        };
                    });

                    return {
                        $promise: Promise.resolve(events)
                    }
                },
                getHistoryViewData: function () {
                    return {
                        $promise: Promise.resolve(self.sessionsTlData),
                    };
                },
                getStreamgraphData: function ({ streamgraph = 'streamgraph' }) {
                    const emotion = _.get(allEmotions, streamgraph)

                    return {
                        $promise: Promise.resolve(emotion),
                    };
                },
            };
        }

        return new EmodashDataService();
    },
]);

