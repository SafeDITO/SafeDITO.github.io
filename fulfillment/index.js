// Webhook for the COVID-19 Bot.
// See https://github.com/dialogflow/dialogflow-fulfillment-nodejs
// for Dialogflow fulfillment library docs, samples, and to report issues.
//
// NOTE: the example code in this template will log user interactions.
'use strict';

const functions = require('firebase-functions');
const {WebhookClient} = require('dialogflow-fulfillment');
const {Payload} = require('dialogflow-fulfillment');
const MapsClient = require('@googlemaps/google-maps-services-js').Client;
const {BigQuery} = require('@google-cloud/bigquery');

process.env.DEBUG = 'dialogflow:debug';  // enables lib debugging statements

// Map from Event type to the labels they should emit.
const HEALTH_CONDITION_EVENT_TYPE_TO_LABEL = {
  'event-health-condition-cardio': 'CARDIO',
  'event-health-condition-dm': 'DM',
  'event-health-condition-lung': 'LUNG',
  'event-health-condition-healtherisk': 'HEALTHRISK'
};

const SYMPTOM_EVENT = {
  // Used for an initial 'None of the above' selection.
  NONE: 'event-symptom-none',
  // Used for 'None of the above' selections after 1 or more symptom selections
  // and for programmatic moves to the next intent.
  NO_MORE: 'event-symptom-no-more',
};

// Map from symptom-related Event type to the labels they should emit.
const SYMPTOM_EVENT_TYPE_TO_LABELS = {
  'event-symptom-cough': ['COUGH', 'SYMPTOMATIC'],
  'event-symptom-fever': ['FEVER', 'SYMPTOMATIC'],
  'event-symptom-shortofbreath': ['SHORTOFBREATH', 'SYMPTOMATIC'],
  [SYMPTOM_EVENT.NONE]: ['ASYMPTOMATIC'],
};

const CARD_G1 = [{
  'type': 'accordion',
  'text':
      'Helpful websites:<ul><li><a href="https://www.cdc.gov/coronavirus/2019-ncov/index.html" target="_blank">COVID-19 Resources For the Public (CDC)</a></li><li><a href="https://www.who.int/emergencies/diseases/novel-coronavirus-2019/advice-for-public" target="_blank">Advice For the Public (WHO)</a></li><li><a href="https://www.google.com/search?q=coronavirus" target="_blank">Help & Info (Google)</a></li></ul>Twitter feeds:<ul><li><a href="https://twitter.com/CDCgov" target="_blank">@CDCgov</a></li><li><a href="https://twitter.com/CDCemergency" target="_blank">@CDCemergency</a></li><li><a href="https://twitter.com/WHO" target="_blank">@WHO</a></li></ul>',
  'title': 'Stay up-to-date on COVID-19',
}];

const CARD_G2 = [{
  'type': 'accordion',
  'text':
      'Learn:<ul><li><a href="https://www.cdc.gov/coronavirus/2019-ncov/prepare/prevention.html" target="_blank">How to Protect Yourself (CDC)</a></li><li><a href="https://www.cdc.gov/coronavirus/2019-ncov/about/steps-when-sick.html" target="_blank">What to Do if Sick (CDC)</a></li><li><a href="https://www.cdc.gov/coronavirus/2019-ncov/faq.html" target="_blank">Questions & Answers (CDC)</a></li></ul>Watch:<ul><li><a href="https://www.youtube.com/watch?v=9Ay4u7OYOhA" target="_blank">Steps to Prevent COVID-19 (CDC)</a></li><li><a href="https://www.youtube.com/watch?v=d914EnpU4Fo" target="_blank">Hand-Washing (CDC)</a></li><li><a href="https://www.youtube.com/watch?v=qPoptbtBjkg" target="_blank">Managing COVID-19 At Home (CDC)</a></li></ul>',
  'title': 'Learn more about staying safe with current information'
}];

const CARD_HF1 = [{
  'type': 'accordion',
  'text':
      'You may be at higher risk of getting very sick from COVID-19. Take these steps:<ul><li>Gather phone numbers for your doctor and pharmacies, lists of medications, testing supplies, and prescription refills.</li><li>Have enough household items and groceries on hand in case you need to stay at home for a period of time.</li><li>Call your doctor if you develop new symptoms such as fever, cough, or shortness of breath.</li><li>Meet with your doctor through telehealth options, if available.</li></ul><a href="https://www.diabetes.org/diabetes/treatment-care/planning-sick-days/coronavirus" target="_blank">COVID-19 Resources</a> (Source: American Diabetes Association)',
  'title': 'Make a plan if you have diabetes'
}];

const CARD_HF2 = [{
  'title': 'Make a plan if you have heart disease',
  'type': 'accordion',
  'text':
      'Having a history of heart disease, hypertension, or stroke may put you at higher risk of getting very sick from COVID-19. Take these steps:<ul><li>Gather phone numbers for your doctor and pharmacies, lists of medications, testing supplies, and prescription refills.</li><li>Have enough household items and groceries on hand in case you need to stay at home for a period of time.</li><li>Recognize and manage stress.</li><li>Stay current with vaccinations, including pneumonia and flu shots.</li></ul><a href="https://www.heart.org/en/about-us/coronavirus-covid-19-resources" target="_blank">COVID-19 Resources</a> (Source: American Heart Association)'
}];

const CARD_HF3 = [{
  'title': 'Make a plan if you have lung disease',
  'type': 'accordion',
  'text':
      'You may be at higher risk of getting very sick from COVID-19. Take these steps:<ul><li>Keep a distance of least 6 feet from others.</li><li>Call your doctor if you develop new symptoms such as fever, cough, or shortness of breath.</li><li>Know and follow your Asthma Action Plan as needed.</li></ul><a href="https://www.lung.org/about-us/media/top-stories/update-covid-19.html" target="_blank">COVID-19 Resources</a> (Source: American Lung Association)'
}];

const CARD_HF4 = [{
  'title': 'Make a plan because of your age or health history',
  'type': 'accordion',
  'text':
      'You may be at higher risk of getting very sick from COVID-19. Take these steps:<ul><li>Gather phone numbers for your doctor and pharmacies, lists of medications, testing supplies, and prescription refills.</li><li>Have enough household items and groceries on hand in case you need to stay at home for a period of time.</li><li>Keep a distance of least 6 feet from others.</li><li>Call your doctor if you develop new symptoms such as fever, cough, or shortness of breath.</li></ul><a href="https://www.cdc.gov/coronavirus/2019-ncov/need-extra-precautions/older-adults.html" target="_blank">Older Adults</a> (Source: CDC)',
}];

const CARD_HF5 = [{
  'title': 'Reduce your exposure risk if you\'re a healthcare professional',
  'type': 'accordion',
  'text':
      'Take these steps:<ul><li>Give your patients face masks</li><li>Isolate patients with fever or cough</li><li>Use personal protective gear for all patient interactions</li><li>Use alcohol-based hand rub before and after contact with patients, potentially infectious material, and before using protective gear.</li></ul><a href="https://www.cdc.gov/coronavirus/2019-ncov/hcp/caring-for-patients.html" target="_blank">For Healthcare Teams</a> (Source: CDC)'
}];

const CARD_R3 = [{
  'type': 'accordion',
  'text':
      'Check your temperature twice a day. Typical symptoms include:<ul><li>Fever</li><li>Cough</li><li>Shortness of breath</li></ul><br>Get medical attention right away if you develop these emergency warning signs:<ul><li>Difficulty breathing</li><li>Constant chest pain or pressure</li><li>New confusion or difficulty waking up</li><li>Bluish lips or face</li></ul><br>COVID-19 can have other symptoms. Contact a medical provider for any severe or concerning symptoms.<br><a href="https://www.cdc.gov/coronavirus/2019-ncov/symptoms-testing/symptoms.html" target="_blank">Symptoms</a> (Source: CDC)',
  'title': 'Pay attention to symptoms',
}];

const CARD_R4 = [{
  'title': 'Take care of yourself at home',
  'type': 'accordion',
  'text':
      'Take these steps:<ul><li>Stay home except to get medical care. Avoid other people living with you.</li><li>Contact your healthcare provider within 24 hours. Discuss your symptoms before visiting.</li><li>Pay attention to your symptoms.</li><li>Wash your hands often with soap, scrubbing for at least 20 seconds each time.</li></ul><a href="https://www.cdc.gov/coronavirus/2019-ncov/if-you-are-sick/steps-when-sick.html" target="_blank">If You Are Sick</a> (Source: CDC)',
}];

const CARD_R5 = [{
  'type': 'accordion',
  'text':
      'COVID-19 is spread through close contact with respiratory droplets that are produced when an infected person coughs or sneezes.<br>Take these steps:<ul><li>Wash your hands often with soap, scrubbing for at least 20 seconds each time.</li><li>Keep a distance of 6 feet from others outside your home.</li><li>Cover coughs and sneezes with a tissue or your bent arm.</li><li>Cover your mouth and nose with a cloth mask when you go out. Children under age 2 and people who have trouble breathing or might not be able to take off their own mask shouldn\'t wear one. Don\'t wear a mask intended for health care workers.</li></ul><a href="https://www.cdc.gov/coronavirus/2019-ncov/prepare/prevention.html" target="_blank">How to Protect Yourself</a> (Source: CDC)',
  'title': 'Stay safe and prevent the spread of illness'
}];

const CARD_R6 = [{
  'title': 'Know the symptoms',
  'type': 'accordion',
  'text':
      'Symptoms include:<ul><li>Fever, with a temperature above 100.4 °F or 38 °C</li><li>Cough</li><li>Shortness of breath</li></ul>Get medical attention right away if you develop these emergency warning signs:<ul><li>Difficulty breathing</li><li>Constant chest pain or pressure</li><li>New confusion or difficulty waking up</li><li>Bluish lips or face</li></ul>COVID-19 can have other symptoms. Contact a medical provider for any severe or concerning symptoms.<br><a href="https://www.cdc.gov/coronavirus/2019-ncov/symptoms-testing/symptoms.html" target="_blank">Symptoms</a> (Source: CDC)'
}];

const CARD_R7 = [{
  'type': 'accordion',
  'text':
      'Help slow the spread of COVID-19. Take these steps:<ul><li>Keep a distance of least 6 feet from others.</li><li>Avoid crowds or crowded spaces.</li></ul><a href="https://www.hopkinsmedicine.org/health/conditions-and-diseases/coronavirus/coronavirus-social-distancing-and-self-quarantine" target="_blank">Distancing & Quarantine</a> (Source: Johns Hopkins Medicine)',
  'title': 'Keep distance from others'
}];

const CARD_R8 = [{
  'type': 'accordion',
  'text':
      'Help slow the spread of COVID-19 by staying home except to get medical care. Take these steps:<ul><li>Stay home until 14 days after last exposure</li><li>Avoid contact with people at higher risk for severe illness (unless they live in the same home and had the same exposure)</li><li>Keep a distance of at least 6 feet from others.</li></ul><a href="https://www.hopkinsmedicine.org/health/conditions-and-diseases/coronavirus/coronavirus-social-distancing-and-self-quarantine" target="_blank">Distancing & Quarantine</a> (Source: Johns Hopkins Medicine)',
  'title': 'Stay inside, without visitors',
}];

const CARD_R9 = [{
  'title': 'Pay attention to symptoms',
  'type': 'accordion',
  'text':
      'Keep track of how you feel.<br>Get medical attention right away if you develop these emergency warning signs:<ul><li>Difficulty breathing</li><li>Constant chest pain or pressure</li><li>New confusion or difficulty waking up</li><li>Bluish lips or face</li></ul>COVID-19 can have other symptoms. Contact a medical provider for any severe or concerning symptoms.<br><a href="https://www.cdc.gov/coronavirus/2019-ncov/symptoms-testing/symptoms.html?CDC_AA_refVal=https%3A%2F%2Fwww.cdc.gov%2Fcoronavirus%2F2019-ncov%2Fabout%2Fsymptoms.html" target="_blank">Symptoms</a> (Source: CDC)'
}];

const CARD_VA_10 = [{
  'title': 'Call in the next 24 hours',
  'type': 'accordion',
  'text':
      'Call your healthcare provider<br><br>You have at least one symptom that may be related to COVID-19.<br>You may be at greater risk for complications from COVID-19.'
}];

const CARDS_BASIC = ['G1', 'G2'];

const CARDS_AGE = ['HF4'];

const CARDS_DM = ['HF1'];

const CARDS_CARDIO = ['HF2'];

const CARDS_LUNG = ['HF3'];

const CARDS_HEALTHRISK = ['HF4'];

const CARDS_HCP = ['HF5'];

const CARDS_HIGH_ASYMPTOMATIC = ['R6', 'R8', 'R5'];

const CARDS_HIGH_SYMPTOMATIC = ['R3', 'R4', 'R5'];

const CARDS_LOW_ASYMPTOMATIC = ['R6', 'R7', 'R5'];

const CARDS_LOW_SYMPTOMATIC = ['R9', 'R7', 'R5'];

const CARDS_URGENT = ['VA10'];

const CARDS_REGISTORY = {
  'G1': {rank: 17, card: CARD_G1},
  'G2': {rank: 18, card: CARD_G2},
  'HF1': {rank: 11, card: CARD_HF1},
  'HF2': {rank: 12, card: CARD_HF2},
  'HF3': {rank: 13, card: CARD_HF3},
  'HF4': {rank: 14, card: CARD_HF4},
  'HF5': {rank: 15, card: CARD_HF5},
  'R3': {rank: 4, card: CARD_R3},
  'R4': {rank: 7, card: CARD_R4},
  'R5': {rank: 10, card: CARD_R5},
  'R6': {rank: 6, card: CARD_R6},
  'R7': {rank: 9, card: CARD_R7},
  'R8': {rank: 8, card: CARD_R8},
  'R9': {rank: 5, card: CARD_R9},
  'VA10': {rank: 3, card: CARD_VA_10},
};

const HEALTH_CONDITION_QUESTION = [
  {
    'title': 'Do you have any other of these conditions? Choose all that apply:',
    'type': 'description'
  },
  {'type': 'divider'}
];

const HEALTH_CONDITION_CARDIO = {
  'event': {'languageCode': 'en', 'name': 'event-health-condition-cardio'},
  'type': 'list',
  'title': 'Serious heart conditions'
};

const HEALTH_CONDITION_DIABETES = {
    'title': 'Diabetes',
    'event':
        {'name': 'event-health-condition-dm', 'languageCode': 'en'},
    'type': 'list'
};

const HEALTH_CONDITION_LUNG = {
  'event': {'languageCode': 'en', 'name': 'event-health-condition-lung'},
  'type': 'list',
  'title': 'Chronic lung disease or moderate to severe asthma'
};

const HEALTH_CONDITION_HEALTHRISK_1 = [
  {
    'title': 'Immunocompromised',
    'subtitle':
        'Many conditions can cause a person to be immunocompromised, including cancer treatment, smoking, bone marrow or organ transplantation, immune deficiencies, poorly controlled HIV or AIDS, and prolonged use of corticosteroids and other immune weakening medications',
    'event':
        {'languageCode': 'en', 'name': 'event-health-condition-healtherisk'},
    'type': 'list'
  },
  {
    'title': 'Severe obesity',
    'subtitle': 'body mass index [BMI] of 40 or higher',
    'event':
        {'languageCode': 'en', 'name': 'event-health-condition-healtherisk'},
    'type': 'list'
  }
];
const HEALTH_CONDITION_HEALTHRISK_2 = [
  {
    'title': 'Chronic kidney disease undergoing dialysis',
    'event':
        {'name': 'event-health-condition-healtherisk', 'languageCode': 'en'},
    'type': 'list'
  },
  {
    'event':
        {'name': 'event-health-condition-healtherisk', 'languageCode': 'en'},
    'type': 'list',
    'title': 'Liver disease'
  }
];

const HEALTH_CONDITION_NONE = {
  'title': 'None of above',
  'event': {'languageCode': 'en', 'name': 'event-health-condition-none'},
  'type': 'list'
};

const SYMPTOM_MULTI_CHOICE_QUESTION = {
  question: {
    'title': 'Do you have any more of these symptoms? Choose all that apply:',
    'type': 'description'
  },
  divider: {'type': 'divider'},
  fever: {
    'event': {'name': 'event-symptom-fever', 'languageCode': 'en'},
    'type': 'list',
    'title': 'Fever (temperature >100.4 °F or 38 °C) or feeling feverish'
  },
  shortofbreath: {
    'event': {'name': 'event-symptom-shortofbreath', 'languageCode': 'en'},
    'type': 'list',
    'title': 'Shortness of breath (not severe)'
  },
  cough: {
    'title': 'Cough',
    'event': {'languageCode': 'en', 'name': 'event-symptom-cough'},
    'type': 'list'
  },
  none: {
    'title': 'None of the above',
    // This event is intentionally distinct from the event used in the initial
    // version of this question, defined in Dialogflow. See
    // SYMPTOM_EVENT.NO_MORE for more info.
    'event': {'name': SYMPTOM_EVENT.NO_MORE, 'languageCode': 'en'},
    'type': 'list'
  }
};

const SUGGESTION_CHIPS = [[{
  'type': 'chips',
  'options': [
    {'text': 'Start screening'}, {'text': 'What is covid-19?'},
    {'text': 'What are the symptoms?'}, {'text': 'How can I protect myself?'}
  ]
}]];


/**
 * Converts time to human a friendly format.
 */
function convertTimeFormat(hours, minutes) {
  var AmOrPm = hours >= 12 ? 'pm' : 'am';
  hours = (hours % 12) || 12;
  return hours + ':' + minutes + ' ' + AmOrPm;
}

/**
 * Gets the opening hours to fulfill the corresponding intent.
 */
function openHours(agent) {
  console.log(
      'openHours: agent.parameters = ' + JSON.stringify(agent.parameters));
  var organization = agent.parameters.organization;
  var geoCity = agent.parameters['geo-city'];
  if (!organization || !geoCity) {
    agent.add(`I didn't understand`);
    agent.add(`I'm sorry, can you try again?`);
    return;
  }

  var location = organization + ' ' + geoCity;
  const mapsClient = new MapsClient({});
  var name;
  return mapsClient
      .findPlaceFromText({
        params: {
          input: location,
          inputtype: 'textquery',
          fields: 'place_id,name',
          key: process.env.GOOGLE_MAPS_API_KEY
        },
        timeout: 5000  // milliseconds
      })
      .then(resp => {
        var candidates = resp.data.candidates;
        console.log('Candidates = ' + JSON.stringify(candidates));
        if (!candidates || !candidates.length) {
          return Promise.reject(
              new Error('No candidates found for location: ' + location));
        }
        var placeId = (candidates[0] || {}).place_id;
        name = (candidates[0] || {}).name;
        if (!placeId) {
          return Promise.reject(
              new Error('No place ID found for location: ' + location));
        }
        return mapsClient.placeDetails({
          params: {
            place_id: placeId,
            fields: 'opening_hours/periods,opening_hours/open_now',
            key: process.env.GOOGLE_MAPS_API_KEY
          },
          timeout: 5000  // milliseconds
        });
      })
      .then(resp => {
        var result = resp.data.result;
        if (!result || !result.opening_hours) {
          return Promise.reject(
              new Error('No opening hours found for location: ' + location));
        }
        var open_now = result.opening_hours.open_now;
        var now = new Date();
        var day = now.getDay();
        var periods = result.opening_hours.periods;
        if (open_now) {
          if (!periods[day] || !periods[day].close) {
            return Promise.reject(
                new Error('No close time found for location: ' + location));
          }
          var close_time = periods[day].close.time;
          var message = 'According to their website ' + name +
              ' will remain open until ' +
              convertTimeFormat(close_time.slice(0, 2), close_time.slice(2));
          agent.add(message);
        } else {
          var tomorrow = new Date();
          tomorrow.setDate(now.getDate() + 1);
          var tomorrowDay = tomorrow.getDay();
          var open_time = periods[tomorrowDay].open.time;
          var message = 'According to their website ' + name +
              ' will remain closed until ' +
              convertTimeFormat(open_time.slice(0, 2), open_time.slice(2));
          agent.add(message);
        }
      })
      .catch(e => {
        if (!!name) {
          agent.add(`I'm sorry, I can't find opening hours for ` + name);
        } else {
          agent.add(`I'm sorry, I can't find opening hours for ` + location);
        }
        console.log(e);
      });
}

/*
 * Queries the Covid-19 metrics dataset for a specific country.
 * Currently we only support country-wide metrics.
 * If you want to add search by other location types, you can look into
 * province_state field of bigquery-public-data.covid19_jhu_csse tables
 * for possible values. You can also find more detailed statistics for USA
 * in this dataset: bigquery-public-data.covid19_usafacts
 * You may also consider caching the result of this call since the data is
 * updated only once a day. You can read more about it here:
 * https://cloud.google.com/bigquery/docs/cached-results
 */
function queryCovid19dataset(tableName, country) {
  if (!['confirmed_cases', 'deaths', 'recovered_cases'].includes(tableName)) {
    return Promise.reject(new Error('Invalid table name ' + tableName));
  }
  // We convert some of the countries names to match those in the dataset.
  // Those countries are recognized by DialogFlow NLU but have different
  // naming conventions that are specific to the tables inside
  // bigquery-public-data.covid19_jhu_csse dataset.
  const countryNameCorrection = {
    'United States': 'US',
    'Cape Verde': 'Cabo Verde',
    'Democratic Republic of the Congo': 'Congo (Kinshasa)',
    'Republic of the Congo': 'Congo (Brazzaville)',
    'Côte d\'Ivoire': 'Cote d\'Ivoire',
    'Vatikan': 'Holy See',
    'South Korea': 'Korea, South',
    'Taiwan': 'Taiwan*',
  };
  if (Object.keys(countryNameCorrection).includes(country)) {
    country = countryNameCorrection[country];
  }
  var totalQuery = `SELECT *
    FROM bigquery-public-data.covid19_jhu_csse.` +
      tableName + `
    `;
  // If the country is specified, we will limit results to that country.
  if (country) {
    totalQuery += `
      WHERE country_region = @country
      `;
  }

  // Run the query.
  const bigqueryClient = new BigQuery();
  return bigqueryClient
      .query({
        query: totalQuery,
        // Include parameters that we specified in the query (@country).
        params: {country},
        location: 'US',
        timeout: 5000  // milliseconds
      })
      .then(resp => {
        const [rows] = resp;
        if (!rows || !rows.length) {
          return null;
        }
        // Sum all the values in the last column - the one with the latest data.
        return rows.map(r => r[Object.keys(r)[Object.keys(r).length - 1]])
            .reduce((a, b) => a + b, 0);
      });
}

/**
 * Gets the confirmed cases to fulfill the corresponding intent.
 */
function confirmedCases(agent) {
  console.log(
      'confirmedCases: agent.parameters = ' + JSON.stringify(agent.parameters));
  // Currently we only support country-wide metrics, but you can extend
  // this webhook to use other location parameters if you want.
  // See the comment in queryCovid19dataset function.
  var country = agent.parameters['geo-country'];
  var resultLocation = '';
  if (country) {
    resultLocation = 'in ' + country;
  } else {
    resultLocation = 'worldwide';
  }

  return queryCovid19dataset('confirmed_cases', country)
      .then(totalConfirmed => {
        if (totalConfirmed === null) {
          return Promise.reject(
              new Error('No data found for confirmed cases ' + resultLocation));
        }

        var message = 'According to Johns Hopkins University, as of today, ' +
            'there are approximately ' + numberWithCommas(totalConfirmed) +
            ' confirmed cases of ' +
            'coronavirus ' + resultLocation + '.';
        console.log('response: ' + message);
        agent.add(message);
      })
      .catch(e => {
        agent.add(
            `I'm sorry, I can't find statistics for confirmed cases ` +
            resultLocation);
        console.log(e);
      });
}

/**
 * Gets the deaths to fulfill the corresponding intent.
 */
function death(agent) {
  console.log('death: agent.parameters = ' + JSON.stringify(agent.parameters));
  // Currently we only support country-wide metrics, but you can extend
  // this webhook to use other location parameters if you want.
  // See the comment in queryCovid19dataset function.
  var country = agent.parameters['geo-country'];
  var resultLocation = '';
  if (country) {
    resultLocation = 'in ' + country;
  } else {
    resultLocation = 'worldwide';
  }

  return queryCovid19dataset('deaths', country)
      .then(totalDeaths => {
        if (totalDeaths === null) {
          return Promise.reject(
              new Error('No data found for deaths ' + resultLocation));
        }

        var message = 'According to Johns Hopkins University, as of today, ' +
            'approximately ' + numberWithCommas(totalDeaths) +
            ' people have died from coronavirus ' + resultLocation + '.';
        return queryCovid19dataset('confirmed_cases', country)
            .then(totalConfirmed => {
              if (!!totalConfirmed) {
                message += ' The death rate ' + resultLocation + ' is ' +
                    (totalDeaths / totalConfirmed * 100.0).toFixed(2) + '%';
              }
              console.log('response: ' + message);
              agent.add(message);
            });
      })
      .catch(e => {
        agent.add(
            `I'm sorry, I can't find statistics for deaths ` + resultLocation);
        console.log(e);
      });
}

/**
 * convert number to a formatted number string.
 */
function numberWithCommas(x) {
  return x.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

/**
 * Adds label to agent context.
 */
function addLabelToContext(agent, label) {
  var label_ctx = agent.context.get('labels');
  if (!label_ctx || !label_ctx.parameters || !label_ctx.parameters.labels) {
    agent.context.set(
        {name: 'labels', lifespan: 20, parameters: {labels: [label]}});
  } else {
    var labels = label_ctx.parameters.labels;
    if (!labels.includes(label)) {
      labels.push(label);
    }
    agent.context.set(
        {name: 'labels', lifespan: 20, parameters: {labels: labels}});
  }
}

/**
 * Adds a dummy payload when there's no other response so that the webhook
 * works in dialogflow-fulfillment:0.6.1.
 */
function addDummyPayload(agent) {
  agent.add(new Payload(agent.UNSPECIFIED, {}));
}

/**
 * Checks the input event for the request and maps into corresponding
 * labels.
 *
 * Responds with the symptom question again, without the already selected
 * options.
 */
function symptomEventMapper(agent) {
  const type = agent.query;
  if (!!type) {
    const newLabels = SYMPTOM_EVENT_TYPE_TO_LABELS[type];
    if (!newLabels) {
      return;
    }
    newLabels.forEach((label) => {
      addLabelToContext(agent, label);
    });

    // After adding the appropriate label(s) for an initial selection of 'None
    // of the above', proceed directly to the next intent.
    if (type === SYMPTOM_EVENT.NONE) {
      agent.setFollowupEvent(SYMPTOM_EVENT.NO_MORE);
      addDummyPayload(agent);
      return;
    }

    let labels = [];
    const label_ctx = agent.context.get('labels');
    if (!!label_ctx && !!label_ctx.parameters &&
        !!label_ctx.parameters.labels) {
      labels = label_ctx.parameters.labels;
    }

    var conditions = [
      SYMPTOM_MULTI_CHOICE_QUESTION.question,
      SYMPTOM_MULTI_CHOICE_QUESTION.divider
    ];
    if (!labels.includes('FEVER')) {
      conditions.push(SYMPTOM_MULTI_CHOICE_QUESTION.fever);
      conditions.push(SYMPTOM_MULTI_CHOICE_QUESTION.divider);
    }
    if (!labels.includes('SHORTOFBREATH')) {
      conditions.push(SYMPTOM_MULTI_CHOICE_QUESTION.shortofbreath);
      conditions.push(SYMPTOM_MULTI_CHOICE_QUESTION.divider);
    }
    if (!labels.includes('COUGH')) {
      conditions.push(SYMPTOM_MULTI_CHOICE_QUESTION.cough);
      conditions.push(SYMPTOM_MULTI_CHOICE_QUESTION.divider);
    }
    conditions.push(SYMPTOM_MULTI_CHOICE_QUESTION.none);

    if (conditions.length == 3) {
      // If conditions only has question, divider and 'none of above', it should
      // set SYMPTOM_EVENT.NO_MORE event to trigger qus.e1-break intent.
      agent.setFollowupEvent(SYMPTOM_EVENT.NO_MORE);
      addDummyPayload(agent);
      return;
    }
    agent.setFollowupEvent(type);
    agent.add(new Payload(
        agent.UNSPECIFIED, {richContent: [conditions]},
        {sendAsMessage: true, rawPayload: true}));
    return;
  }
  addDummyPayload(agent);
}

/**
 * Checks the input event for the request and maps into corresponding
 * labels.
 */
function healthConditionEventMapper(agent) {
  var type = agent.query;
  if (!!type) {
    var label = HEALTH_CONDITION_EVENT_TYPE_TO_LABEL[type];
    if (!label) {
      return;
    }
    addLabelToContext(agent, label);

    var labels = [];
    var label_ctx = agent.context.get('labels');
    if (!!label_ctx && !!label_ctx.parameters &&
        !!label_ctx.parameters.labels) {
      labels = label_ctx.parameters.labels;
    }

    var conditions = HEALTH_CONDITION_QUESTION.slice();
    if (!labels.includes('LUNG')) {
      conditions.push(HEALTH_CONDITION_LUNG);
    }
    if (!labels.includes('CARDIO')) {
      conditions.push(HEALTH_CONDITION_CARDIO);
    }
    if (!labels.includes('HEALTHRISK')) {
      conditions.push(...HEALTH_CONDITION_HEALTHRISK_1);
    }
    if (!labels.includes('DM')) {
      conditions.push(HEALTH_CONDITION_DIABETES);
    }
    if (!labels.includes('HEALTHRISK')) {
      conditions.push(...HEALTH_CONDITION_HEALTHRISK_2);
    }
    conditions.push(HEALTH_CONDITION_NONE);

    if (conditions.length == 3) {
      // If conditons only has question, divider and 'none of above', it should
      // set 'event-health-condition-none' event to trigger qus.p3-break intent.
      agent.setFollowupEvent('event-health-condition-none');
      addDummyPayload(agent);
      return;
    }
    agent.setFollowupEvent(type);
    agent.add(new Payload(
        agent.UNSPECIFIED, {richContent: [conditions]},
        {sendAsMessage: true, rawPayload: true}));
    return;
  }
  addDummyPayload(agent);
}

/**
 * Given the labels in the current context, decides which cards to
 * suggest to users.
 */
function actionMapper(agent) {
  var labels = [];
  // The labels context holds risk labels set from this webhook.
  var label_ctx = agent.context.get('labels');
  if (!label_ctx || !label_ctx.parameters || !label_ctx.parameters.labels) {
    console.log('No labels to suggest actions');
  } else {
    labels = label_ctx.parameters.labels;
  }
  // The risk_labels context holds risk set from parameters.
  var risk_label_ctx = agent.context.get('risk_labels');
  if (!!risk_label_ctx && !!risk_label_ctx.parameters) {
    for (let param in risk_label_ctx.parameters) {
      if (!param.startsWith('risk_label') || param.endsWith(".original")) {
        continue;
      }
      labels.push(risk_label_ctx.parameters[param]);
    }
  } else {
    console.log('No risk labels to suggest actions');
  }
  if (agent.intent === 'end-yes' && !labels.includes('HCP')) {
    labels.push('HCP');
  }
  if (!agent.requestSource) {
    // Set a special source to enable rich responses.
    agent.requestSource = 'DIALOGFLOW_MESSENGER';
  }

  var cards = CARDS_BASIC.slice(0);
  // Map from different label combinations to cards.
  if (labels.includes('HIGH')) {
    if (labels.includes('SYMPTOMATIC')) {
      cards = cards.concat(CARDS_HIGH_SYMPTOMATIC);
    } else if (labels.includes('ASYMPTOMATIC')) {
      cards = cards.concat(CARDS_HIGH_ASYMPTOMATIC);
    }
  } else if (labels.includes('LOW')) {
    if (labels.includes('SYMPTOMATIC')) {
      cards = cards.concat(CARDS_LOW_SYMPTOMATIC);
    } else if (labels.includes('ASYMPTOMATIC')) {
      cards = cards.concat(CARDS_LOW_ASYMPTOMATIC);
    }
  }
  var has_health_condition = false;
  if (labels.includes('DM')) {
    cards = cards.concat(CARDS_DM);
    has_health_condition = true;
  }
  if (labels.includes('CARDIO')) {
    cards = cards.concat(CARDS_CARDIO);
    has_health_condition = true;
  }
  if (labels.includes('LUNG')) {
    cards = cards.concat(CARDS_LUNG);
    has_health_condition = true;
  }
  if (labels.includes('HEALTHRISK')) {
    cards = cards.concat(CARDS_HEALTHRISK);
    has_health_condition = true;
  }
  if (labels.includes('AGE')) {
    cards = cards.concat(CARDS_AGE);
    has_health_condition = true;
  }
  if (labels.includes('HCP')) {
    cards = cards.concat(CARDS_HCP);
  }

  if (labels.includes('SHORTOFBREATH') ||
      (has_health_condition &&
       (labels.includes('FEVER') || labels.includes('COUGH')))) {
    cards = cards.concat(CARDS_URGENT);
  }

  var cards_to_render =
      Array.from(new Set(cards))
          .sort(function(a, b) {
            return CARDS_REGISTORY[b].rank - CARDS_REGISTORY[a].rank;
          })
          .map(function(a) {
            return CARDS_REGISTORY[a].card;
          });
  agent.add(new Payload(
      agent.UNSPECIFIED, {richContent: cards_to_render},
      {sendAsMessage: true, rawPayload: true}));
  // Clear context.
  agent.context.set({name: 'labels', lifespan: 0});
  agent.context.set({name: 'risk_labels', lifespan: 0});
}

exports.dialogflowFirebaseFulfillment =
    functions.https.onRequest((request, response) => {
      if (!!request.body.queryResult.fulfillmentMessages) {
        request.body.queryResult.fulfillmentMessages =
            request.body.queryResult.fulfillmentMessages.map(m => {
              if (!m.platform) {
                // Set the platform to UNSPECIFIED instead of null.
                m.platform = 'PLATFORM_UNSPECIFIED';
              }
              return m;
            });
      }

      const agent = new WebhookClient({request, response});
      console.log(
          'Dialogflow Request headers: ' + JSON.stringify(request.headers));
      console.log('Dialogflow Request body: ' + JSON.stringify(request.body));

      // Register function handlers based on the matched Dialogflow intent name.
      let intentMap = new Map();
      intentMap.set('coronavirus.closure', openHours);
      intentMap.set('coronavirus.confirmed_cases', confirmedCases);
      intentMap.set('coronavirus.death', death);
      intentMap.set('qus.e1-continue', symptomEventMapper);
      intentMap.set('qus.p3-continue', healthConditionEventMapper);
      intentMap.set('end-yes', actionMapper);
      intentMap.set('end-no', actionMapper);
      agent.handleRequest(intentMap);
    });
