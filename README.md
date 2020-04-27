# SafeDITO - Virtual Assistant for Disaster, Disease and Emergency

Based from `Verily Pathfinder Virtual Agent Template for COVID-19` (April 24, 2020) by [GoogleCloudPlatform](https://github.com/GoogleCloudPlatform) under [CC-BY 4.0 License](https://github.com/GoogleCloudPlatform/covid19-rapid-response-demo/blob/master/agent-template/LICENSE):

    https://github.com/GoogleCloudPlatform/covid19-rapid-response-demo


## Features
* Capable of Health Screening
* Philippine Emergency Hotlines
* Huge Database of Frequently Asked Questions (FAQs) from various trusted source(s):
    * [World Health Organization (WHO)](https://www.who.int/news-room/q-a-detail/q-a-coronaviruses)
    * [Deparnment of Health (DOH)](https://www.doh.gov.ph/COVID-19/FAQs)
    * [Centers for Disease Control (CDC)](https://www.cdc.gov/coronavirus/2019-ncov/faq.html)
    * [Philippine Statistic Authority (PSA)](view-source:https://psa.gov.ph/content/q-sexual-harassment-cases)
* Integratable to Messaging Applications such as Alibaba's DingTalk, Facebook Messenger, etc.
* Real-time updates on Covid-19 confirmed / death cases (selected country only)

## Live Demo

    https://safedito.github.io/

## Tech Stack
* HTML5 / JavaScript / Bootstrap 4
* DialogFlow / Cloud Functions / BigQuery API

## Getting Started
1. Clone this repository
    
    `git clone https://github.com/SafeDITO/safedito.github.io.git`

2. Compress the following directories:
    * agent -> agent.zip
    * fulfillment -> fulfillment.zip

3. Import the agents / fulfillments to Google DialogFlow.

## TO DO:
1. Improve the content and UI/UX in `index.html`
2. Improve knowledgebase and intents
