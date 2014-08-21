var usenewrelic = (typeof process.env.WNU_NEW_RELIC_ENABLED == 'undefined' || process.env.WNU_NEW_RELIC_ENABLED == 'true');
if (usenewrelic) {
    require('newrelic');
} else {
    console.log("New Relic disabled in config");
}
var express = require('express'),
    classifications = require('./routes/classifications');
 
var app = express();

app.use('/', express.static(__dirname +'/client'));

app.use(express.logger('dev'));     /* 'default', 'short', 'tiny', 'dev' */
app.use(express.bodyParser());

app.get('/classificationCount', classifications.getClassificationCount);
app.get('/classifications/:count/offset/:offset', classifications.getLastClassifications);
app.get('/classifications/from/:from/to/:to/interval/:interval', classifications.getClassificationInterval); // charts
app.get('/classificationCount/latest/:seconds',classifications.getClassificationCountLatest);
//app.get('/updateAnalytics',classifications.updateAnalytics);
//app.get('/updateTimeSeries',classifications.updateTimeSeries);
//app.get('/updateTimeSeries/from/:from/to/:to/interval/:interval', classifications.updateTimeSeries);
app.get('/analytics',classifications.getAnalytics);
app.get('/analytics/totals',classifications.getAnalyticsAggregateCountries);
app.get('/timeseries',classifications.getTimeSeries); // client
app.get('/timeseries/intervals/:intervals',classifications.getTimeSeriesIntervals); // client
app.get('/timeseries/from/:from/to/:to',classifications.getTimeSeriesBetweenDates); // client
app.get('/ping', classifications.ping); // monitor

app.get('/dbstats',classifications.getDBstats);

var port = process.env.PORT || 3000;
app.listen(port);
console.log('Listening on port ' + port + '...');

// Execute commands in clean exit
process.on('exit', function () {
    console.log('Exiting ...');
    classifications.cleanUp();
    console.log('bye');
});

// happens when you press Ctrl+C
process.on('SIGINT', function () {
    console.log( '\nGracefully shutting down from SIGINT (Crtl-C)' );
    process.exit();
});

// usually called with kill
process.on('SIGTERM', function () {
    console.log('Parent SIGTERM detected (kill)');
    // exit cleanly
    process.exit(0);
});

module.exports.app = app;
