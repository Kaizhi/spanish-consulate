'use strict';
const moment = require('moment');
const cheerio = require('cheerio');
const request = require('request');
const exec = require('child_process').exec;
const app = require('express')();
const cron = require('cron').CronJob;
const notifier = require('node-notifier');

app.get('/', (req, res) => {
    res.send('Earliest avail date: ', getDisplayDate());
});
app.listen(3000);

const SCRAPE_URL = 'http://www.exteriores.gob.es/Consulados/TORONTO/en/Consulado/Pages/Articulos/VISAS-ALL-THE-INFORMATION-YOU-NEED--.aspx';
const SCRAPE_LINK_SELECTOR = '#ctl00_PlaceHolderMain_ctl01_ctl05__ControlWrapper_RichHtmlField > div:nth-child(27) > div:nth-child(5) > span > a';
const DAY_AVAILABLE = 'clsAvailable';
const CURRENT_MONTH = parseInt(moment().format('M'));
const CRON_QUARTER_HOUR = '*/15 * * * *';
const MOMENT_FORMAT = 'MM-DD-YYYY';
let earliestDate = false;

const getCmd = function(key, month) {
  return "curl 'https://app.bookitit.com/en/widgets/ajax_get_month_closed_days/" + key + "/2016/" + month + "/dtlbook/" + key + "/3/' -X POST -H 'Pragma: no-cache' -H 'Origin: https://app.bookitit.com' -H 'Accept-Encoding: gzip, deflate, br' -H 'Accept-Language: en-US,en;q=0.8' -H 'User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_11_3) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/52.0.2743.82 Safari/537.36' -H 'Accept: */*' -H 'Cache-Control: no-cache' -H 'X-Requested-With: XMLHttpRequest' -H 'Cookie: PHPSESSID=msjbnu02lo2bl2on15853b9i15' -H 'Connection: keep-alive' -H 'Referer: https://app.bookitit.com/en/widgets/dtlbook/" + key + "/3' -H 'Content-Length: 0' --compressed";
};

const getDisplayDate = function() {
  if (!earliestDate) return 'No dates found yet';
  return moment(earliestDate, MOMENT_FORMAT).format('dddd, MMMM Do YYYY');
}

// Scrape the site for teh latest request url
let fetchAvailableDay = function() {
  request(SCRAPE_URL, function (error, response, body) {
    if (!error) {
      let $ = cheerio.load(body);
      let count = 0, found = false;
      let bookingUrl = $(SCRAPE_LINK_SELECTOR).attr('href');
      bookingUrl = bookingUrl.split('/')[bookingUrl.split('/').length - 1]

      let getFirstAvailableDay = function(bookingUrl, count) {
        exec(getCmd(bookingUrl, CURRENT_MONTH + count), (err, stdout, stderr) => {
          // command output is in stdout
          var daysOfMonth = stdout.split(',').map((item) => {
            return item.split(';');
          }).filter(item => item.length > 1);

          let availableDay = daysOfMonth.find((item) => {
            return item[1] === DAY_AVAILABLE;
          });

          if (!availableDay) {
            getFirstAvailableDay(bookingUrl, count + 1);
          } else {
            console.log('Current available date is: ', moment(availableDay[0], MOMENT_FORMAT).format('dddd, MMMM Do YYYY'));
            if (earliestDate) {
              if (moment(earliestDate, MOMENT_FORMAT).isBefore(moment(availableDay[0], MOMENT_FORMAT))) {
                notifier.notify({
                  'title': 'Consulate Date',
                  'message': 'Earliar date found: ' + getDisplayDate()
                });
              }
            }
            earliestDate = availableDay[0];
          }
        });
      }

      getFirstAvailableDay(bookingUrl, count);
    } else {
      console.log("We’ve encountered an error: " + error);
    }
  });
}

new cron(CRON_QUARTER_HOUR, function() {
    console.log('running fetch');
    fetchAvailableDay();
  }, function () {
    console.log('stopped');
  },
  true
);
