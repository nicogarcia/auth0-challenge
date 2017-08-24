'use strict';

const firebase = require('firebase');

const config = {
    apiKey: "AIzaSyBjM4d5tWfqYJgRWNjO_ag9UNGfBXJpAsE",
    authDomain: "auth0-aguante.firebaseapp.com",
    databaseURL: "https://auth0-aguante.firebaseio.com",
    projectId: "auth0-aguante",
    storageBucket: "auth0-aguante.appspot.com",
    messagingSenderId: "937497444895"
};

const winningScore = 80;
const challengeTime = 300;

const getWinners = winners => {
    const timestamp = new Date().getTime() / 1000;

    const currentSlot = timestamp - timestamp % challengeTime;
    const currentWinner = winners[currentSlot] || null;

    const latestWinnerTimestamp = Object.keys(winners).sort((a, b) => b - a)[0] || null;
    const latestWinner = winners[latestWinnerTimestamp] || null;

    let winnersResult = {
        global: {},
        latest: {
            site: latestWinner,
            timestamp: latestWinnerTimestamp
        },
        current: currentWinner
    };

    Object.keys(winners).map(x => {
        const value = winners[x];

        if (!winnersResult.global.hasOwnProperty(value)) {
            winnersResult.global[value] = 0;
        }

        winnersResult.global[value] += 1;
    });

    return winnersResult;
};

const getSitesScores = sites => {
    const now = new Date().getTime() / 1000;
    const timestamp = now - (now % 5) - 10;
    let sitesResult = {};

    Object.keys(sites).map(site => {
        const timestamps = Object.keys(sites[site]);

        sitesResult[site] = timestamps
            .map(ts => parseInt(ts) >= timestamp ? sites[site][ts] : 0)
            .reduce((p, c) => p + c, 0);
    });

    return sitesResult;
};

const processStatus = store => {
    const sites = getSitesScores(store.sites);
    const winners = getWinners(store.winners);

    return {sites, winners};
};

const writeWinner = (store, winner) => {
    const timestamp = new Date().getTime() / 1000;
    const currentSlot = timestamp - timestamp % challengeTime;

    store.winners[currentSlot] = winner;

    return store;
};

const initialStore = () => ({winners: {}, sites: {}});

const GET = (context, cb) => {
    const firebaseApp = firebase.initializeApp(config, (new Date()).toISOString());
    const database = firebaseApp.database();
    const sitesRef = database.ref('data');

    firebaseApp.auth().signInWithEmailAndPassword(context.secrets.firebaseUser, context.secrets.firebasePassword)
      .then(() => {
        context.storage.get((err, store) => {
            if (!store) {
                store = initialStore();
            }

            const result = processStatus(store);

            sitesRef.set(result);
            firebaseApp.delete();
            cb(null, result);
        });
    });
};

const POST = (context, cb) => {
    const site = context.body.site;

    if (!site) {
        cb(400, {});
        return;
    }

    const now = (new Date()).getTime() / 1000;
    const timestamp = now - (now % 5);

    context.storage.get((err, store) => {
        if (!store) {
            store = initialStore();
        }

        const storeSites = store.sites;

        if (!storeSites.hasOwnProperty(site)) {
            storeSites[site] = {};
        }

        if (!storeSites[site].hasOwnProperty(timestamp)) {
            storeSites[site][timestamp] = 0;
        }

        storeSites[site][timestamp] += 1;

        const winners = getWinners(store.winners);
        if (winners.current) {
            return cb(null, processStatus(store));
        }

        let attempts = 3;

        context.storage.set(store, function setCb(error) {
            if (error) {
                if (error.code === 409 && attempts--) {
                    console.log('Write score conflict: ', error);
                    // resolve conflict and re-attempt set
                    let counter = Math.max(store.sites[site][timestamp], error.conflict[site][timestamp]) + 1;
                    store.sites[site][timestamp] = counter;
                    return context.storage.set(store, setCb);
                }
                return cb(error);
            }

            const scores = getSitesScores(store.sites);
            const winners = Object.keys(scores).filter(site => scores[site] >= winningScore);
            const winner = winners.length > 0 ? winners[0] : null;
            // TODO: Check multiple winners

            if (winner) {
                const updatedStore = writeWinner(store, winner);

                let attempts = 3;
                context.storage.set(updatedStore, function setCb(error) {
                    if (error) {
                        if (error.code === 409 && attempts--) {
                            console.log('Write winner conflict: ', error);
                            // TODO: Add conflict resolution logic
                            return;
                        }
                        return cb(error);
                    }

                    return cb(null, processStatus(updatedStore));
                });
            }

            return cb(null, processStatus(store));
        });

    });
};

module.exports = function (context, cb) {
    if (context.hasOwnProperty('body')) {
        POST(context, cb);
    } else {
        GET(context, cb);
    }
};