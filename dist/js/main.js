let sitesData = [{
    id: 'BUENOS_AIRES',
    label: 'Bs. As.',
    value: 0,
    url: 'img/tango.png'
}, {
    id: 'SEATTLE',
    label: 'Seattle',
    value: 0,
    url: 'img/seattle.png'
}, {
    id: 'LONDON',
    label: 'London',
    value: 0,
    url: 'img/big_ben.png'
}];

let winners = null;

let body = d3.select('body');
let svg = d3.select('#chart')
    .append('svg')
    .attr('width', '100%')
    .attr('height', '100%');

let relativeWidth;
let relativeHeight;
let offset = 20;
let globalEnd = 150;
let relativeEnd;
let challengeTime = 300;
let lastVoteTime = null;

document.addEventListener('DOMContentLoaded', function () {
    // Draw challenge timer
    setInterval(drawTimer, 1000);

    updateDrawingSizes();
    drawChallengeBackground();
    drawStats(sitesData, winners);
    updateChallengeDraw(sitesData, winners);

    // Add event listener to get challenge updates from Firebase
    firebase.app().database().ref('data').on('value', snapshot => {
        onChallengeStatusReceived(snapshot.val());
    });
});

window.addEventListener("resize", function () {
    updateDrawingSizes();

    drawChallengeBackground();

    updateChallengeDraw(sitesData, winners);
});

const onFeedbackSubmit = () => {
    const submitButton = document.getElementById('submit-feedback');
    const feedbackElement = document.getElementById('comment');
    const value = feedbackElement.value;

    firebase.app().database().ref('feedback').push({
        timestamp: new Date(),
        comment: value
    });

    feedbackElement.value = '';
    submitButton.innerHTML = 'Thanks!';

    setTimeout(() => submitButton.innerHTML = 'submit', 1000)
};

function updateDrawingSizes() {
    relativeWidth = parseInt(svg.node().getBoundingClientRect().width);
    relativeHeight = svg.node().getBoundingClientRect().height;
    relativeEnd = relativeWidth - 2 * offset;
}

function drawTimer() {
    let timestamp = moment().utc().unix();
    let remainingTime = challengeTime - timestamp % challengeTime;

    body.select('#remaining-time')
        .text(parseInt(remainingTime / 60) + 'm ' + (remainingTime % 60) + 's');
}

function drawStats(citiesData, winners) {
    // Write latest winner
    /*body.select('#latest-winner')
     .text(() => winners.latest ? citiesData.find(x => x.id === winners.latest.site).label : '-');*/

    // Stats update nodes
    let statUpdateNodes = body.select('#sites')
        .selectAll('div')
        .data(citiesData, d => d.id);

    // Stats enter nodes
    let statsEnterNodes = statUpdateNodes.enter()
        .append('div')
        .attr('class', 'stats');

    // Add site's title
    statsEnterNodes
        .append('p')
        .attr('class', 'stats-title')
        .text(d => d.label);

    // Add site's score
    statsEnterNodes
        .append('p')
        .attr('class', 'stats-score');

    // Add site's score
    statsEnterNodes
        .append('p')
        .attr('class', 'stats-wins');

    // Add site's vote button
    statsEnterNodes
        .append('a')
        .text(d => 'Vote')
        .attr('href', d => 'javascript:sendVote("' + d.id + '")')
        .attr('id', d => d.id)
        .style('float', 'left')
        .style('width', '70%');

    // Stats enter + update nodes
    let statsMergeNodes = statsEnterNodes
        .merge(statUpdateNodes);

    // Update stats divs
    statsMergeNodes
        .style('float', 'left')
        .style('width', Math.floor(80 / citiesData.length) + '%');

    // Update site's score
    statsMergeNodes.selectAll('.stats-score')
        .text(d => 'Score: ' + (d.value || '0'));

    // Update site's wins
    statsMergeNodes
        .selectAll('.stats-wins')
        .text(d => 'Wins: ' + (winners && winners.global[d.id] ? winners.global[d.id] : '0'));
}

function drawChallengeBackground() {
    let squareSize = 5;
    let flagWidth = 8;

    svg.selectAll('.flag').remove();

    for (let i = 0; i < Math.floor(relativeHeight / squareSize); i++) {
        for (let j = 0; j < flagWidth; j++) {
            svg.append('rect')
                .attr('class', 'flag')
                .attr('x', relativeEnd + j * squareSize - offset)
                .attr('y', i * squareSize)
                .attr('height', squareSize)
                .attr('width', squareSize)
                .style('fill', (i % 2) === (j % 2) ? 'black' : 'white')
                .lower();
        }
    }

    svg.append('rect')
        .attr('class', 'flag')
        .attr('x', 0)
        .attr('y', 0)
        .attr('width', relativeWidth)
        .attr('height', relativeHeight)
        .attr('stroke-width', 2)
        .attr('stroke', 'white')
        .attr('fill', '#eaeaea')
        .lower();
}

function updateChallengeDraw(data, winners) {
    let symbols = svg.selectAll('image')
        .data(data, d => d.id);

    symbols
        .enter()
        .append('image')
        .attr('id', d => d.id)
        .attr('xlink:href', d => d.url)
        .merge(symbols)
        .transition()
        .duration(500)
        .attr('y', (d, i) => ((i + 1 / 2) * 30) + '%')
        .attr('x', d => Math.min(relativeEnd - offset, offset + d.value * relativeEnd / globalEnd))
        .attr('height', 20 + '%');

    if (winners && winners.current) {
        const g = svg
            .append('g')
            .attr('width', '100%')
            .attr('height', '100%')
            .attr('class', 'winner-banner');

        g.append('rect')
            .attr('width', '100%')
            .attr('height', '100%')
            .attr('fill', '#eb5424');

        g.append('text')
            .text('Winner:')
            .attr('x', '10%')
            .attr('y', '25%')
            .style('fill', 'white')
            .style('font-size', '1.5rem');

        g.append('text')
            .text(sitesData.find(site => site.id === winners.current).label)
            .attr('x', '10%')
            .attr('y', '45%')
            .style('fill', 'white')
            .style('font-size', '2rem');
    } else {
        svg.selectAll('g.winner-banner').remove()
    }
}

function onChallengeStatusReceived(response) {
    sitesData = sitesData.map(site => {
        site.value = response.sites[site.id];
        return site;
    });

    winners = response.winners;

    drawStats(sitesData, winners);
    updateChallengeDraw(sitesData, winners)
}

function sendVote(site) {
    const now = new Date().getTime();

    if (lastVoteTime === null || (now - lastVoteTime >= 500)) {
        const url = 'https://wt-e2c222553120d8740ef397c25290539b-0.run.webtask.io/auth0-aguante';

        const req = new XMLHttpRequest();

        req.onreadystatechange = function () {
            if (req.status === 200 && req.readyState === 4) {
                const response = JSON.parse(req.responseText);

                onChallengeStatusReceived(response);
            }
        };

        req.open('POST', url, true);
        req.setRequestHeader("Content-Type", "application/json");
        req.send(JSON.stringify({site: site}));

        lastVoteTime = now;
    }
}