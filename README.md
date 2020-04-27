# SafeDITO - Virtual Assistant for Disaster, Disease and Emergency

Based from `Verily Pathfinder Virtual Agent Template for COVID-19` (April 24, 2020) by [GoogleCloudPlatform](https://github.com/GoogleCloudPlatform) under [CC-BY 4.0 License](https://github.com/GoogleCloudPlatform/covid19-rapid-response-demo/blob/master/agent-template/LICENSE):

    https://github.com/GoogleCloudPlatform/covid19-rapid-response-demo


## Features
* Capable of Health Screening
* Philippine Emergency Hotlines
* Huge Database of Knowledge, Info Graphics and Frequently Asked Questions (FAQs) from trusted sources:
    * [World Health Organization (WHO)](https://www.who.int/news-room/q-a-detail/q-a-coronaviruses)
    * [Deparnment of Health (DOH)](https://www.doh.gov.ph/COVID-19/FAQs)
    * [Centers for Disease Control (CDC)](https://www.cdc.gov/coronavirus/2019-ncov/faq.html)
    * [Philippine Statistic Authority (PSA)](view-source:https://psa.gov.ph/content/q-sexual-harassment-cases)
    * [University of the Philippines' Covid-19 Web Portal](https://endcov.ph/dashboard/)
    * [Metropolitan Manila Development Authority (MMDA)](http://www.mmda.gov.ph/20-faq/288-disaster-awareness-faq.html)

* Integratable to Websites and Messaging Applications such as Alibaba's DingTalk, Facebook Messenger, etc.
* Real-time updates on Covid-19 confirmed / death cases (selected country only)
* Info Graphics


## Supported Topics:
(*Author Note: This needs to be improved*)
* COVID-19
* Sexual Harassment
* Info Graphics for Earthquake, Fire, Typhoon and Tsunami
* First Aid Treatments


## Live Demo

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;https://safedito.github.io


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

4. Configure Google Cloud Function and Google APIs.

5. Add DialogFlow's Messenger Widget Code to a website (e.g. `index.html` on this repo)


## Author / License
`SafeDITO` (April 2020) by DITO Telecommunity Technology Team under [Creative Commons Zero v1.0 Universal](https://github.com/GoogleCloudPlatform/covid19-rapid-response-demo/blob/master/agent-template/LICENSE)


## TO DO:
1. Improve the content and UI/UX in `index.html`
2. Improve knowledgebase, intents and conversation skills
