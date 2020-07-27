const messages_all = require('./messages-all.json');
const optionSets = require('./config-optionSets.json');
const mapping = require('./mapping.json');
const axios = require("axios");
const {MessageFactory} = require("botbuilder");

const question = require('./flow.json');
const orgUnitLevels = require('./country-levels.json');
const { response } = require('express');

const MAX_FACEBOOK_OPTIONS = 11;
const FB_MOVE_TO_RIGHT = '->';
const FB_MOVE_TO_LEFT = '<-';

var messages;
var endpointConfig;

async function questionLanguage(flow, turnContext, profile) {
    flow.nextQuestion = question.validateLanguage;
    let message = MessageFactory.suggestedActions(Object.keys(optionSets[mapping.Languages].options[profile.userLanguage]), messages.questionLanguage);
    await turnContext.sendActivity(message);
}

async function validateLanguage(flow, turnContext, profile) {
    let validation = validateOption(mapping.Languages, profile.userLanguage, turnContext.activity.text);
    if (validation.success) {
        flow.nextQuestion = question.policy;
        profile.userLanguage = convertOption(mapping.Languages,validation.validatedValue, profile.userLanguage);
        messages = messages_all[profile.userLanguage];
    } else {
        flow.nextQuestion = question.language;
        await turnContext.sendActivity(validation.message);        
    }
}

async function questionPolicy(flow, turnContext, profile) {
    flow.nextQuestion = question.validatePolicy;
    let message = MessageFactory.suggestedActions(Object.keys(optionSets[mapping.YesNoFixed].options[profile.userLanguage]), messages.questionPolicy);
    message.attachments = [getInternetAttachment()];
    await turnContext.sendActivity(message);
}

async function validatePolicy(flow, turnContext, profile) {
    let validation = validateOption(mapping.YesNoFixed, profile.userLanguage, turnContext.activity.text);
    if (validation.success) {
        if (["Yes"].includes(validation.validatedValue)) {
            var value = await getProfile(profile);
            if (value.status == 200) {
                console.log('The user exists');
                flow.nextQuestion = question.userExist;
            } else {
                await saveProfile(profile);
                flow.nextQuestion = question.country;
            }
         } else flow.nextQuestion = question.finishNoSave;
    } else {
        flow.nextQuestion = question.policy;
        await turnContext.sendActivity(validation.message);        
    }
}

async function questionUserExist(flow, turnContext, profile) {
    flow.nextQuestion = question.validateUserExist;
    let message = MessageFactory.suggestedActions(Object.keys(optionSets[mapping.YesNoFixed].options[profile.userLanguage]), messages.questionUserExists);
    await turnContext.sendActivity(message);
}

async function validateUserExist(flow, turnContext, profile) {
    let validation = validateOption(mapping.YesNoFixed, profile.userLanguage, turnContext.activity.text);
    if (validation.success) {
        if (["Yes"].includes(validation.validatedValue)) {
            flow.nextQuestion = question.country;
         } else flow.nextQuestion = question.finishNoSave;
    } else {
        flow.nextQuestion = question.userExist;
        await turnContext.sendActivity(validation.message);        
    }
}

async function questionCountry(flow, turnContext, profile) {
    flow.nextQuestion = question.validateCountry;
    let message = MessageFactory.suggestedActions(Object.keys(optionSets["Countries"].options[profile.userLanguage]), messages.questionCountry);
    await turnContext.sendActivity(message);
}

async function validateCountry(flow, turnContext, profile) {
    let validation = validateOption(mapping.Countries, profile.userLanguage, turnContext.activity.text);
    if (validation.success) {
        flow.nextQuestion = question.orgunit;
        profile.country = convertOption(mapping.Countries,validation.validatedValue, profile.userLanguage)
        profile.userOrgUnit = orgUnitLevels[profile.country].root
        profile.userOrgUnitLevel = 0;
    } else {
        flow.nextQuestion = question.country;
        await turnContext.sendActivity(validation.message);  
    }
}

async function questionOrgUnit(flow, turnContext, profile) {  
    if (turnContext.activity.text == FB_MOVE_TO_RIGHT || turnContext.activity.text == FB_MOVE_TO_LEFT) {
        flow.nextQuestion = question.orgunit;
        if (turnContext.activity.text == FB_MOVE_TO_RIGHT)
            profile.currentFBOptPosition = profile.currentFBOptPosition + 9;
        else 
            profile.currentFBOptPosition = profile.currentFBOptPosition -9;
    } else {
        if (profile.userOrgUnitLevel != 0) {
            var selectedOrgUnit = getOrgUnitId(profile.orgUnitsToChoose, turnContext.activity.text);
            if (selectedOrgUnit != null) {
                profile.userOrgUnit = selectedOrgUnit.id;
            } else {
                flow.nextQuestion = question.orgunit;
                profile.userOrgUnitLevel = 0;
                profile.userOrgUnit = orgUnitLevels[profile.country].root;
            }
        }       
        profile.currentFBOptPosition = 0;
        if (profile.userOrgUnitLevel == orgUnitLevels[profile.country].levels) {
            flow.nextQuestion = question.donor;
            saveOrgUnit(profile);
            return;
        } else {
            flow.nextQuestion = question.orgunit;
            profile.userOrgUnitLevel++;
            profile.currentFBOptPosition = 0;
            var response = await getChilrenOU(profile);
            profile.orgUnitsToChoose = response.data;           
        }       
    } 
    var OUs = profile.orgUnitsToChoose;
    var ouToShow = returnFBOptions(getOUItems(OUs), profile.currentFBOptPosition);
    var text = messages.questionOrgUnit + ' ' + orgUnitLevels[profile.country][profile.userLanguage][profile.userOrgUnitLevel.toString()];
    let message = MessageFactory.suggestedActions(ouToShow, text);
    await turnContext.sendActivity(message);
}


async function oldquestionOrgUnit(flow, turnContext, profile) {    
    if (profile.userOrgUnitLevel == orgUnitLevels[profile.country].levels && 
        (turnContext.activity.text != FB_MOVE_TO_RIGHT && turnContext.activity.text != FB_MOVE_TO_LEFT)) {
        flow.nextQuestion = question.donor;
        profile.userOrgUnit = getOrgUnitId(profile.orgUnitsToChoose, turnContext.activity.text).id;
        profile.currentFBOptPosition = 0;
        saveOrgUnit(profile);
    } else {
        if (profile.userOrgUnitLevel != 0) {
            var selectedOrgUnit = getOrgUnitId(profile.orgUnitsToChoose, turnContext.activity.text);
            if (selectedOrgUnit !=null) {
                profile.userOrgUnit = selectedOrgUnit.id;
            }
        }
        //var action = null;
        flow.nextQuestion = question.orgunit;
        if (turnContext.activity.text == FB_MOVE_TO_RIGHT || turnContext.activity.text == FB_MOVE_TO_LEFT) {
            if (turnContext.activity.text == FB_MOVE_TO_RIGHT) {
                profile.currentFBOptPosition = profile.currentFBOptPosition + 9;
                //action = FB_MOVE_TO_RIGHT;
            } else {
                profile.currentFBOptPosition = profile.currentFBOptPosition -9;
                //action = FB_MOVE_TO_RIGHT;
            }
        } else {
            profile.userOrgUnitLevel++;
            profile.currentFBOptPosition = 0;
            var response = await getChilrenOU(profile);
            profile.orgUnitsToChoose = response.data;
        }
        var OUs = profile.orgUnitsToChoose;
        var ouToShow = returnFBOptions(getOUItems(OUs), profile.currentFBOptPosition);
        var text = messages.questionOrgUnit + ' ' + orgUnitLevels[profile.country][profile.userLanguage][profile.userOrgUnitLevel.toString()];
        let message = MessageFactory.suggestedActions(ouToShow, text);
        await turnContext.sendActivity(message);
    }
}

async function questionDonor (flow, turnContext, profile) {
    flow.nextQuestion = question.saveAndValidateDonor;
    var optionsToShow = returnFBOptions(Object.keys(optionSets[mapping.donor].options[profile.country]), profile.currentFBOptPosition);
    let message = MessageFactory.suggestedActions(optionsToShow, messages.questionDonor);
    await turnContext.sendActivity(message);
}

async function saveAndValidateDonor (flow, turnContext, profile)  {
    let validation = validateOption(mapping.donor, profile.country, turnContext.activity.text);
    if (validation.success) {
        flow.nextQuestion = question.firstName;
        await saveDataValue(profile, mapping.donor, convertOption(mapping.donor,validation.validatedValue, profile.country));
    } else {
        if (turnContext.activity.text == FB_MOVE_TO_LEFT || turnContext.activity.text == FB_MOVE_TO_RIGHT) {
            if (turnContext.activity.text == FB_MOVE_TO_RIGHT) {
                profile.currentFBOptPosition = profile.currentFBOptPosition + 9;
                action = FB_MOVE_TO_RIGHT;
            }
            else {
                profile.currentFBOptPosition = profile.currentFBOptPosition -9;
                action = FB_MOVE_TO_RIGHT;
            }            
        }
        flow.nextQuestion = question.donor;
        await turnContext.sendActivity(validation.message);
    }
}

async function questionFirstName (flow, turnContext)  {
    flow.nextQuestion = question.saveAndValidateFirstName;
    await turnContext.sendActivity(messages.questionFirstName);
}

async function saveAndValidateFirstName (flow, turnContext, profile)  {
    flow.nextQuestion = question.lastName;
    result = await saveDataValue(profile, mapping.firstName, turnContext.activity.text);
}

async function questionLastName (flow, turnContext)  {
    flow.nextQuestion = question.saveAndValidateLastName;
    await turnContext.sendActivity(messages.questionLastName);
}

async function saveAndValidateLastName (flow, turnContext, profile)  {
    flow.nextQuestion = question.gender;
    await saveDataValue(profile, mapping.lastName, turnContext.activity.text);
}

async function questionGender (flow, turnContext, profile) {
    flow.nextQuestion = question.saveAndValidateGender;
    let message = MessageFactory.suggestedActions(Object.keys(optionSets[mapping.gender].options[profile.userLanguage]), messages.questionGender);
    await turnContext.sendActivity(message);
}

async function saveAndValidateGender (flow, turnContext, profile)  {
    let validation = validateOption(mapping.gender, profile.userLanguage, turnContext.activity.text);
    if (validation.success) {
        flow.nextQuestion = question.dateOfBirth;
        await saveDataValue(profile, mapping.gender, convertOption(mapping.gender,validation.validatedValue, profile.userLanguage));
    } else {
        flow.nextQuestion = question.gender;
        await turnContext.sendActivity(validation.message);
    }
}

async function questionDateOfBirth (flow, turnContext)  {
    flow.nextQuestion = question.saveAndValidateDateOfBirth;
    await turnContext.sendActivity(messages.questionDateOfBirth);
}

async function saveAndValidateDateOfBirth (flow, turnContext, profile)  {
    let validation = validateDate(turnContext.activity.text);
    if (validation.success) {
        flow.nextQuestion = question.presentAddress;
        await saveDataValue(profile, mapping.dateOfBirth, turnContext.activity.text);       
    } else {
        flow.nextQuestion = question.dateOfBirth;
        await turnContext.sendActivity(validation.message);
    }
}
async function questionPresentAddress (flow, turnContext)  {
    flow.nextQuestion = question.saveAndValidatePresentAddress;
    await turnContext.sendActivity(messages.questionPresentAddress);
}

async function saveAndValidatePresentAddress (flow, turnContext, profile)  {
    flow.nextQuestion = question.permanentAddress;
    await saveDataValue(profile, mapping.presentAddress, turnContext.activity.text);
}

async function questionPermanentAddress (flow, turnContext)  {
    flow.nextQuestion = question.saveAndValidatePermanentAddress;
    await turnContext.sendActivity(messages.questionPermanentAddress);
}

async function saveAndValidatePermanentAddress (flow, turnContext, profile)  {
    flow.nextQuestion = question.contactNumber;
    await saveDataValue(profile, mapping.permanentAddress, turnContext.activity.text);
}

async function questionContactNumber (flow, turnContext)  {
    flow.nextQuestion = question.saveAndValidateContactNumber;
    await turnContext.sendActivity(messages.questionPhoneNumber);
}

async function saveAndValidateContactNumber (flow, turnContext, profile)  {
    flow.nextQuestion = question.disability;
    await saveDataValue(profile, mapping.contactNumber, turnContext.activity.text);
}

async function questionDisability (flow, turnContext, profile) {
    flow.nextQuestion = question.saveAndValidateDisability;
    let message = MessageFactory.suggestedActions(Object.keys(optionSets[mapping.disability].options[profile.userLanguage]), messages.questionDisability);
    await turnContext.sendActivity(message);
}

async function saveAndValidateDisability (flow, turnContext, profile)  {
    let validation = validateOption(mapping.disability, profile.userLanguage, turnContext.activity.text);
    if (validation.success) {
        if (["Yes"].includes(validation.validatedValue)) {
            flow.nextQuestion = question.disability1;
         } else flow.nextQuestion = question.below21Years;
         await saveDataValue(profile, mapping.disability, convertOption(mapping.disability,validation.validatedValue, profile.userLanguage));
    } else {
        flow.nextQuestion = question.disability;
        await turnContext.sendActivity(validation.message);
    }
}

async function questionDisability1 (flow, turnContext, profile) {
    flow.nextQuestion = question.saveAndValidateDisability1;
    let message = MessageFactory.suggestedActions(Object.keys(optionSets[mapping.disability1].options[profile.userLanguage]), messages.questionDisability1);
    await turnContext.sendActivity(message);
}

async function saveAndValidateDisability1 (flow, turnContext, profile)  {
    let validation = validateOption(mapping.disability1, profile.userLanguage, turnContext.activity.text);
    if (validation.success) {
        flow.nextQuestion = question.disability2;
        await saveDataValue(profile, mapping.disability1, convertOption(mapping.disability1,validation.validatedValue, profile.userLanguage));
    } else {
        flow.nextQuestion = question.disability1;
        await turnContext.sendActivity(validation.message);
    }
}

async function questionDisability2 (flow, turnContext, profile) {
    flow.nextQuestion = question.saveAndValidateDisability2;
    let message = MessageFactory.suggestedActions(Object.keys(optionSets[mapping.disability2].options[profile.userLanguage]), messages.questionDisability2);
    await turnContext.sendActivity(message);
}

async function saveAndValidateDisability2 (flow, turnContext, profile)  {
    let validation = validateOption(mapping.disability2, profile.userLanguage, turnContext.activity.text);
    if (validation.success) {
        flow.nextQuestion = question.disability3;
        await saveDataValue(profile, mapping.disability2, convertOption(mapping.disability2,validation.validatedValue, profile.userLanguage));
    } else {
        flow.nextQuestion = question.disability2;
        await turnContext.sendActivity(validation.message);
    }
}

async function questionDisability3 (flow, turnContext, profile) {
    flow.nextQuestion = question.saveAndValidateDisability3;
    let message = MessageFactory.suggestedActions(Object.keys(optionSets[mapping.disability3].options[profile.userLanguage]), messages.questionDisability3);
    await turnContext.sendActivity(message);
}

async function saveAndValidateDisability3 (flow, turnContext, profile)  {
    let validation = validateOption(mapping.disability3, profile.userLanguage, turnContext.activity.text);
    if (validation.success) {
        flow.nextQuestion = question.disability4;
        await saveDataValue(profile, mapping.disability3, convertOption(mapping.disability3,validation.validatedValue, profile.userLanguage));
    } else {
        flow.nextQuestion = question.disability3;
        await turnContext.sendActivity(validation.message);
    }
}

async function questionDisability4 (flow, turnContext, profile) {
    flow.nextQuestion = question.saveAndValidateDisability4;
    let message = MessageFactory.suggestedActions(Object.keys(optionSets[mapping.disability4].options[profile.userLanguage]), messages.questionDisability4);
    await turnContext.sendActivity(message);
}

async function saveAndValidateDisability4 (flow, turnContext, profile)  {
    let validation = validateOption(mapping.disability4, profile.userLanguage, turnContext.activity.text);
    if (validation.success) {
        flow.nextQuestion = question.disability5;
        await saveDataValue(profile, mapping.disability4, convertOption(mapping.disability4,validation.validatedValue, profile.userLanguage));
    } else {
        flow.nextQuestion = question.disability4;
        await turnContext.sendActivity(validation.message);
    }
}

async function questionDisability5 (flow, turnContext, profile) {
    flow.nextQuestion = question.saveAndValidateDisability5;
    let message = MessageFactory.suggestedActions(Object.keys(optionSets[mapping.disability5].options[profile.userLanguage]), messages.questionDisability5);
    await turnContext.sendActivity(message);
}

async function saveAndValidateDisability5 (flow, turnContext, profile)  {
    let validation = validateOption(mapping.disability5, profile.userLanguage, turnContext.activity.text);
    if (validation.success) {
        flow.nextQuestion = question.disability6;
        await saveDataValue(profile, mapping.disability5, convertOption(mapping.disability5,validation.validatedValue, profile.userLanguage));
    } else {
        flow.nextQuestion = question.disability5;
        await turnContext.sendActivity(validation.message);
    }
}

async function questionDisability6 (flow, turnContext, profile) {
    flow.nextQuestion = question.saveAndValidateDisability6;
    let message = MessageFactory.suggestedActions(Object.keys(optionSets[mapping.disability6].options[profile.userLanguage]), messages.questionDisability6);
    await turnContext.sendActivity(message);
}

async function saveAndValidateDisability6 (flow, turnContext, profile)  {
    let validation = validateOption(mapping.disability6, profile.userLanguage, turnContext.activity.text);
    if (validation.success) {
        flow.nextQuestion = question.below21Years;
        await saveDataValue(profile, mapping.disability6, convertOption(mapping.disability6,validation.validatedValue, profile.userLanguage));
    } else {
        flow.nextQuestion = question.disability6;
        await turnContext.sendActivity(validation.message);
    }
}

async function questionBelow21Years(flow, turnContext, profile) {
    flow.nextQuestion = question.validate21Years;
    let message = MessageFactory.suggestedActions(Object.keys(optionSets[mapping.YesNoFixed].options[profile.userLanguage]), messages.questionBelow21);
    await turnContext.sendActivity(message);
}

async function validateBelow21Years(flow, turnContext, profile) {
    let validation = validateOption(mapping.YesNoFixed, profile.userLanguage, turnContext.activity.text);
    if (validation.success) {
        if (["Yes"].includes(validation.validatedValue)) {
            flow.nextQuestion = question.guardian;
         } else { 
             flow.nextQuestion = question.maritalStatus;
             await saveDataValue(profile, mapping.guardian, "NA");
         }
    } else {
        flow.nextQuestion = question.below21Years;
        await turnContext.sendActivity(validation.message);        
    }
}

async function questionGuardian (flow, turnContext, profile) {
    flow.nextQuestion = question.saveAndValidateGuardian;
    let message = MessageFactory.suggestedActions(Object.keys(optionSets[mapping.guardian].options[profile.userLanguage]), messages.questionGuardian);
    await turnContext.sendActivity(message);
}

async function saveAndValidateGuardian (flow, turnContext, profile)  {
    let validation = validateOption(mapping.guardian, profile.userLanguage, turnContext.activity.text);
    if (validation.success) {
        if (!["NA"].includes(validation.validatedValue)) {
            flow.nextQuestion = question.guardianDetails1;
            profile.guardian = convertOption(mapping.guardian, validation.validatedValue, profile.userLanguage);
        } else flow.nextQuestion = question.maritalStatus;
        await saveDataValue(profile, mapping.guardian, convertOption(mapping.guardian,validation.validatedValue, profile.userLanguage));
    } else {
        flow.nextQuestion = question.guardian;
        await turnContext.sendActivity(validation.message);
    }
}

async function questionGuardianDetails1(flow, turnContext, profile) {
    flow.nextQuestion = question.saveAndValidateGuardianDetails1;
    var text = messages.questionGuardianFirstName + ' (' + profile.guardian + ')';
    await turnContext.sendActivity(text);
}

async function saveAndValidateGuardianDetails1(flow, turnContext, profile) {
    flow.nextQuestion = question.guardianDetails2;
    var mappingGuardianDetails;

    switch (profile.guardian) {
        case "Mother": {mappingGuardianDetails = mapping.motherFirstName; break;}
        case "Father": {mappingGuardianDetails = mapping.fatherFirstName; break;}
        case "Guardian": {mappingGuardianDetails = mapping.guardianFirstName; break;}
    }
    await saveDataValue(profile, mappingGuardianDetails, turnContext.activity.text);
}

async function questionGuardianDetails2(flow, turnContext, profile) {
    flow.nextQuestion = question.saveAndValidateGuardianDetails2;
    var text = messages.questionGuardianMiddleName + ' (' + profile.guardian + ')';
    await turnContext.sendActivity(text);
}

async function saveAndValidateGuardianDetails2(flow, turnContext, profile) {
    flow.nextQuestion = question.guardianDetails3;
    var mappingGuardianDetails;

    switch (profile.guardian) {
        case "Mother": {mappingGuardianDetails = mapping.motherMiddleName; break;}
        case "Father": {mappingGuardianDetails = mapping.fatherMiddleName; break;}
        case "Guardian": {mappingGuardianDetails = mapping.guardianMiddleName; break;}
    }
    await saveDataValue(profile, mappingGuardianDetails, turnContext.activity.text);
}

async function questionGuardianDetails3(flow, turnContext, profile) {
    flow.nextQuestion = question.saveAndValidateGuardianDetails3;
    var text = messages.questionGuardianLastName + ' (' + profile.guardian + ')';
    await turnContext.sendActivity(text);
}

async function saveAndValidateGuardianDetails3(flow, turnContext, profile) {
    flow.nextQuestion = question.guardianDetails4;
    var mappingGuardianDetails;

    switch (profile.guardian) {
        case "Mother": {mappingGuardianDetails = mapping.motherLastName; break;}
        case "Father": {mappingGuardianDetails = mapping.fatherLastName; break;}
        case "Guardian": {mappingGuardianDetails = mapping.guardianLastName; break;}
    }
    await saveDataValue(profile, mappingGuardianDetails, turnContext.activity.text);
}

async function questionGuardianDetails4(flow, turnContext, profile) {
    flow.nextQuestion = question.saveAndValidateGuardianDetails4;
    var text = messages.questionGuardianConctact + ' (' + profile.guardian + ')';
    await turnContext.sendActivity(text);
}

async function saveAndValidateGuardianDetails4(flow, turnContext, profile) {
    flow.nextQuestion = question.guardianDetails5;
    var mappingGuardianDetails;

    switch (profile.guardian) {
        case "Mother": {mappingGuardianDetails = mapping.motherContactNumber; break;}
        case "Father": {mappingGuardianDetails = mapping.fatherContactNumber; break;}
        case "Guardian": {mappingGuardianDetails = mapping.guardianContactNumber; break;}
    }
    await saveDataValue(profile, mappingGuardianDetails, turnContext.activity.text);
}

async function questionGuardianDetails5(flow, turnContext, profile) {
    flow.nextQuestion = question.saveAndValidateGuardianDetails5;
    var text = messages.questionGuardianOccupation + ' (' + profile.guardian + ')';
    await turnContext.sendActivity(text);
}

async function saveAndValidateGuardianDetails5(flow, turnContext, profile) {
    flow.nextQuestion = question.maritalStatus;
    var mappingGuardianDetails;

    switch (profile.guardian) {
        case "Mother": {mappingGuardianDetails = mapping.motherOccupation; break;}
        case "Father": {mappingGuardianDetails = mapping.fatheerOccupation; break;}
        case "Guardian": {mappingGuardianDetails = mapping.guardianOccupation; flow.nextQuestion = question.guardianDetails6; break;}
    }
    await saveDataValue(profile, mappingGuardianDetails, turnContext.activity.text);
}

async function questionGuardianDetails6(flow, turnContext, profile) {
    flow.nextQuestion = question.saveAndValidateGuardianDetails6;
    var text = messages.questionGuardianRelationship;
    await turnContext.sendActivity(text);
}

async function saveAndValidateGuardianDetails6(flow, turnContext, profile) {
    flow.nextQuestion = question.maritalStatus;
    await saveDataValue(profile, mapping.guardianRelationship, turnContext.activity.text);
}

async function questionMaritalStatus (flow, turnContext, profile) {
    flow.nextQuestion = question.saveAndValidateMaritalStatus;
    let message = MessageFactory.suggestedActions(Object.keys(optionSets[mapping.maritalStatus].options[profile.userLanguage]), messages.questionMaritalStatus);
    await turnContext.sendActivity(message);
}

async function saveAndValidateMaritalStatus (flow, turnContext, profile)  {
    let validation = validateOption(mapping.maritalStatus, profile.userLanguage, turnContext.activity.text);

    if (validation.success) {
        if (["Married", "Menikah", "Tinggal bersama", "Living with partner"].includes(validation.validatedValue)) {
            flow.nextQuestion = question.partnerName;
        } else if (["Single parent", "Orangtua tunggal"].includes(validation.validatedValue)) {
            flow.nextQuestion = question.children;
        } else {flow.nextQuestion = question.studying;}

        await saveDataValue(profile, mapping.maritalStatus, convertOption(mapping.maritalStatus,validation.validatedValue, profile.userLanguage));
    } else {
        flow.nextQuestion = question.maritalStatus;
        await turnContext.sendActivity(validation.message);
    }
}

async function questionPartnerName(flow, turnContext) {
    flow.nextQuestion = question.saveAndValidatePartnerName;
    await turnContext.sendActivity(messages.questionPartnerName);
}

async function saveAndValidatePartnerName(flow, turnContext, profile) {
    flow.nextQuestion = question.partnerOccupation;
    await saveDataValue(profile, mapping.partnerName, turnContext.activity.text);
}

async function questionPartnerOccupation(flow, turnContext) {
    flow.nextQuestion = question.saveAndValidatePartnerOccupation;
    await turnContext.sendActivity(messages.questionPartnerOccupation);
}

async function saveAndValidatePartnerOccupation(flow, turnContext, profile) {
    flow.nextQuestion = question.partnerContactNumber;
    await saveDataValue(profile, mapping.partnerOccupation, turnContext.activity.text);
}

async function questionPartnerContactNumber(flow, turnContext) {
    flow.nextQuestion = question.saveAndValidatePartnerContactNumber;
    await turnContext.sendActivity(messages.questionPartnerContactNumber);
}

async function saveAndValidatePartnerContactNumber(flow, turnContext, profile) {
    flow.nextQuestion = question.children;
    await saveDataValue(profile, mapping.partnerContactNumber, turnContext.activity.text);
}

async function questionChildren(flow, turnContext, profile) {
    flow.nextQuestion = question.saveAndValidateChildren;
    let message = MessageFactory.suggestedActions(Object.keys(optionSets[mapping.children].options[profile.userLanguage]), messages.questionChildren);
    await turnContext.sendActivity(message);
}

async function saveAndValidateChildren (flow, turnContext, profile)  {
    let validation = validateOption(mapping.children, profile.userLanguage, turnContext.activity.text);
    if (validation.success) {
        if (["Yes"].includes(validation.validatedValue)) {
            flow.nextQuestion = question.numberChildren;
         } else flow.nextQuestion = question.studying;
         await saveDataValue(profile, mapping.children, convertOption(mapping.children,validation.validatedValue, profile.userLanguage));
    } else {
        flow.nextQuestion = question.children;
        await turnContext.sendActivity(validation.message);
    }
}

async function questionNumberChildren(flow, turnContext, profile) {
    flow.nextQuestion = question.saveAndValidateNumberChildren;
    let message = MessageFactory.suggestedActions(Object.keys(optionSets[mapping.numberChildren].options[profile.userLanguage]), messages.questionNumberChildren);
    await turnContext.sendActivity(message);
}

async function saveAndValidateNumberChildren (flow, turnContext, profile)  {
    let validation = validateOption(mapping.numberChildren, profile.userLanguage, turnContext.activity.text);
    if (validation.success) {
        profile.numberChildren = convertOption(mapping.numberChildren,validation.validatedValue, profile.userLanguage);
        profile.child = 1;
        flow.nextQuestion = question.childrenAge;

        await saveDataValue(profile, mapping.numberChildren, convertOption(mapping.numberChildren,validation.validatedValue, profile.userLanguage));
    } else {
        flow.nextQuestion = question.numberChildren;
        await turnContext.sendActivity(validation.message);
    }
}

async function questionChildrenAge(flow, turnContext, profile) {
    flow.nextQuestion = question.saveAndValidateChildrenAge;
    var text = messages.questionChildrenAge + profile.child;
    await turnContext.sendActivity(text);
}

async function saveAndValidateChildrenAge(flow, turnContext, profile) {
    var dataElement;
    switch (profile.child) {
        case 1: {dataElement = mapping.child1Age; break;} 
        case 2: {dataElement = mapping.child2Age; break;} 
        case 3: {dataElement = mapping.child3Age; break;} 
        case 4: {dataElement = mapping.child4Age; break;} 
        case 5: {dataElement = mapping.child5Age; break;} 
        case 6: {dataElement = mapping.child6Age; break;} 
        case 7: {dataElement = mapping.child7Age; break;} 
        case 8: {dataElement = mapping.child8Age; break;} 
        case 9: {dataElement = mapping.child9Age; break;} 
        case 10: {dataElement = mapping.child10Age; break;} 
    }

    let validation = validateAge(turnContext.activity.text);
    if (validation.success) {
        await saveDataValue(profile, dataElement, turnContext.activity.text);
        flow.nextQuestion = question.childrenGender;
    } else {
        flow.nextQuestion = question.childrenAge;
        await turnContext.sendActivity(validation.message);
    }

}

async function questionChildrenGender(flow, turnContext, profile) {
    flow.nextQuestion = question.saveAndValidateChildrenGender;
    var text = messages.questionChildrenGender + profile.child;
    let message = MessageFactory.suggestedActions(Object.keys(optionSets[mapping.gender].options[profile.userLanguage]), text);
    await turnContext.sendActivity(message);
}

async function saveAndValidateChildrenGender(flow, turnContext, profile) {
    var dataElement;
    switch (profile.child) {
        case 1: {dataElement = mapping.child1Gender; break;} 
        case 2: {dataElement = mapping.child2Gender; break;} 
        case 3: {dataElement = mapping.child3Gender; break;} 
        case 4: {dataElement = mapping.child4Gender; break;} 
        case 5: {dataElement = mapping.child5Gender; break;} 
        case 6: {dataElement = mapping.child6Gender; break;} 
        case 7: {dataElement = mapping.child7Gender; break;} 
        case 8: {dataElement = mapping.child8Gender; break;} 
        case 9: {dataElement = mapping.child9Gender; break;} 
        case 10: {dataElement = mapping.child10Gender; break;} 
    }

    let validation = validateOption(dataElement, profile.userLanguage, turnContext.activity.text);
    if (validation.success) {
        if (profile.child == profile.numberChildren) {
            flow.nextQuestion = question.studying;
        } else {flow.nextQuestion = question.childrenAge; profile.child = profile.child+1;}
        await saveDataValue(profile, dataElement, convertOption(dataElement,validation.validatedValue, profile.userLanguage));
    } else {
        flow.nextQuestion = question.childrenGender;
        await turnContext.sendActivity(validation.message);
    }
}

async function questionStudying(flow, turnContext, profile) {
    flow.nextQuestion = question.saveAndValidateStudying;
    let message = MessageFactory.suggestedActions(Object.keys(optionSets[mapping.studying].options[profile.userLanguage]), messages.questionStudying);
    await turnContext.sendActivity(message);
}

async function saveAndValidateStudying (flow, turnContext, profile)  {
    let validation = validateOption(mapping.studying, profile.userLanguage, turnContext.activity.text);
    if (validation.success) {
        flow.nextQuestion = question.employed;
         await saveDataValue(profile, mapping.studying, convertOption(mapping.children,validation.validatedValue, profile.userLanguage));
         if (["No"].includes(validation.validatedValue)) {
             profile.studying = 'No';
         }
    } else {
        flow.nextQuestion = question.studying;
        await turnContext.sendActivity(validation.message);
    }
}

async function questionEmployed(flow, turnContext, profile) {
    flow.nextQuestion = question.saveAndValidateEmployed;
    let message = MessageFactory.suggestedActions(Object.keys(optionSets[mapping.employed].options[profile.userLanguage]), messages.questionEmployed);
    await turnContext.sendActivity(message);
}

async function saveAndValidateEmployed (flow, turnContext, profile)  {
    let validation = validateOption(mapping.employed, profile.userLanguage, turnContext.activity.text);
    if (validation.success) {
        flow.nextQuestion = question.interests;
        await saveDataValue(profile, mapping.employed, convertOption(mapping.employed,validation.validatedValue, profile.userLanguage));
    } else {
        flow.nextQuestion = question.employed;
        await turnContext.sendActivity(validation.message);
    }
}

async function questionInterests (flow, turnContext)  {
    flow.nextQuestion = question.saveAndValidateInterests;
    await turnContext.sendActivity(messages.questionEducation1);
}

async function saveAndValidateInterests (flow, turnContext, profile)  {
    flow.nextQuestion = question.highestEducation;
    result = await saveDataValue(profile, mapping.interests, turnContext.activity.text);
}

async function questionHighestEducation (flow, turnContext)  {
    flow.nextQuestion = question.saveAndValidateHighestEducation;
    await turnContext.sendActivity(messages.questionEducation2);
}

async function saveAndValidateHighestEducation (flow, turnContext, profile)  {
    flow.nextQuestion = question.yearGraduated;
    result = await saveDataValue(profile, mapping.highestEducation, turnContext.activity.text);
}

async function questionYearGraduated (flow, turnContext)  {
    flow.nextQuestion = question.saveAndValidateYearGraduated;
    await turnContext.sendActivity(messages.questionEducation3);
}

async function saveAndValidateYearGraduated (flow, turnContext, profile)  {
    let validation = validatePositiveInteger(turnContext.activity.text);
    if (validation.success) {
        if (profile.studying == 'No') {
            flow.nextQuestion = question.stopEducation;
        } else {flow.nextQuestion = question.memberOrganisation;}
        result = await saveDataValue(profile, mapping.yearGraduated, turnContext.activity.text);    
    } else {
        flow.nextQuestion = question.yearGraduated;
        await turnContext.sendActivity(validation.message);
    }
}

async function questionStopEducation (flow, turnContext)  {
    flow.nextQuestion = question.saveAndValidateStopEducation;
    await turnContext.sendActivity(messages.questionEducation4);
}

async function saveAndValidateStopEducation (flow, turnContext, profile)  {
    flow.nextQuestion = question.memberOrganisation;
    result = await saveDataValue(profile, mapping.stopEducation, turnContext.activity.text);
}

async function questionMemberOrganisation (flow, turnContext, profile) {
    flow.nextQuestion = question.saveAndValidateMemberOrganisation;
    let message = MessageFactory.suggestedActions(Object.keys(optionSets[mapping.memberOrganisation].options[profile.userLanguage]), messages.questionEducation5);
    await turnContext.sendActivity(message);
}

async function saveAndValidateMemberOrganisation (flow, turnContext, profile)  {
    let validation = validateOption(mapping.memberOrganisation, profile.userLanguage, turnContext.activity.text);
    if (validation.success) {
        if (["Yes"].includes(validation.validatedValue)) {
            flow.nextQuestion = question.organisationName;
         } else flow.nextQuestion = question.recreations;
         await saveDataValue(profile, mapping.memberOrganisation, convertOption(mapping.memberOrganisation,validation.validatedValue, profile.userLanguage));
    } else {
        flow.nextQuestion = question.memberOrganisation;
        await turnContext.sendActivity(validation.message);
    }
}

async function questionOrganisationName (flow, turnContext)  {
    flow.nextQuestion = question.saveAndValidateOrganisationName;
    await turnContext.sendActivity(messages.questionEducation6);
}

async function saveAndValidateOrganisationName (flow, turnContext, profile)  {
    flow.nextQuestion = question.position;
    result = await saveDataValue(profile, mapping.organizationName, turnContext.activity.text);
}

async function questionPosition (flow, turnContext)  {
    flow.nextQuestion = question.saveAndValidatePosition;
    await turnContext.sendActivity(messages.questionEducation7);
}

async function saveAndValidatePosition (flow, turnContext, profile)  {
    flow.nextQuestion = question.yearsMembership;
    result = await saveDataValue(profile, mapping.position, turnContext.activity.text);
}

async function questionYearsMembership (flow, turnContext)  {
    flow.nextQuestion = question.saveAndValidateYearsMembership;
    await turnContext.sendActivity(messages.questionEducation8);
}

async function saveAndValidateYearsMembership (flow, turnContext, profile)  {
    let validation = validatePositiveInteger(turnContext.activity.text);
    if (validation.success) {
        flow.nextQuestion = question.recreations;
        result = await saveDataValue(profile, mapping.yearsMembership, turnContext.activity.text);    
    } else {
        flow.nextQuestion = question.yearsMembership;
        await turnContext.sendActivity(validation.message);
    }

}

async function questionRecreations (flow, turnContext)  {
    flow.nextQuestion = question.saveAndValidateRecreations;
    await turnContext.sendActivity(messages.questionEducation9);
}

async function saveAndValidateRecreations (flow, turnContext, profile)  {
    flow.nextQuestion = question.finish;
    result = await saveDataValue(profile, mapping.recreations, turnContext.activity.text);
}

async function finish (flow, turnContext, profile)  {
    await sendToDhis2(profile);
    await turnContext.sendActivity(messages.thankyou);
    flow.nextQuestion = question.welcome;
}

async function finishNoSave (flow, turnContext)  {
    await turnContext.sendActivity(messages.thankyouNoSave);
    flow.nextQuestion = question.welcome;
}

async function initProfile(profile, turnContext, _endpointConfig) {
    // clear the profile
    for (var member in profile) delete profile[member];

    //Set the language and locale of the user
    profile.userLanguage = "en" //TODO. change this to allow multiple languages
    profile.userOrgUnitLevel = 0;
    profile.currentFBOptPosition = 0;
    endpointConfig = _endpointConfig
    //profile.country = 'IDN';
    //profile.userOrgUnit = orgUnitLevels[profile.country].root;
    messages = messages_all[profile.userLanguage];

    // Set Facebook ID
    var facebookID = turnContext.activity.from.id;
    profile.facebookID = facebookID;

    return 1;
}

function validateOption(optionSetUID, userLanguage, optionToValidate) {
    let validOptions = Object.keys(optionSets[optionSetUID].options[userLanguage]);

    // create dictionary. Key-upper, value, validValue
    let validOptionsDict = {};
    validOptions.forEach(option => {
        validOptionsDict[option.toUpperCase()] = option;
    });

    let optionToValidateCleaned = optionToValidate.toUpperCase().trim();

    if (Object.keys(validOptionsDict).includes(optionToValidateCleaned)) {
        return { success: true, validatedValue: validOptionsDict[optionToValidateCleaned] };
    } else {
        return { success: false, message: messages.InvalidOption };
    }
}

function validateDate(potentialDate) {
    try {

        // check for the pattern
        var regex_date = /^\d{4}-\d{2}-\d{2}$/;

        if (!regex_date.test(potentialDate)) {
            throw (1);
        }

        // Parse the date parts to integers
        var dateTokens = potentialDate.split("-");
        var dateDay = parseInt(dateTokens[2], 10);
        var dateMonth = parseInt(dateTokens[1], 10);
        var dateYear = parseInt(dateTokens[0], 10);

        var currentDate = new Date();
        var d = Date.parse(potentialDate)

        if (Date.parse(potentialDate)> currentDate) {
            throw (1);
        }

        // Check the ranges of month and year
        if (dateYear < 1000 || dateYear > 3000 || dateMonth == 0 || dateMonth > 12) {
            throw (1);
        }

        var monthLength = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

        // Adjust for leap years
        if (dateYear % 400 == 0 || (dateYear % 100 != 0 && dateYear % 4 == 0)) {
            monthLength[1] = 29;
        }

        // Check the range of the day
        if (dateDay > 0 && dateDay <= monthLength[dateMonth - 1]) {
            return {
                success: true,
                validatedValue: dateMonth + '/' + dateDay + '/' + dateYear
            };
        } else {
            throw (1);
        }

    } catch (error) {
        return {
            success: false,
            message: messages.InvalidDate
        };
    }
}


function validatePositiveInteger(potentialPositiveInteger) {
    try {
        if (!potentialPositiveInteger.match(/^[+]?[0-9]+$/g))
            throw (1);
        let n = parseInt(potentialPositiveInteger);
        if (!isNaN(potentialPositiveInteger) && n >= 0) {
            return { success: true, validatedValue: n };
        }
        return { success: false, message: messages.InvalidPositiveOrZeroInteger };
    } catch (error) {
        return { success: false, message: messages.InvalidPositiveOrZeroInteger };
    }
}

function validateAge(potentialAge) {
    try {
        if (!potentialAge.match(/^[0-9]+$/g))
            throw (1);
        let age = parseInt(potentialAge);
        if (!isNaN(potentialAge) && age >= 0 && age <= 200) {
            return { success: true, validatedValue: age };
        }
        return { success: false, message: messages.InvalidAge };
    } catch (error) {
        return { success: false, message: messages.InvalidAge };
    }
}

function convertOption(optionSetUID, botValue, userLanguage) {
    if (optionSetUID in optionSets) {
        if (botValue in optionSets[optionSetUID].options[userLanguage]) {
            return optionSets[optionSetUID].options[userLanguage][botValue];
        }
    }
    return null; // No conversion
}

function getOUItems(data) {
    var OUs = [];

    data.forEach(ou => OUs.push(ou.name));
    return OUs.sort();
}

function returnFBOptions(data, lastPosition) {
    var len = data.length;
    
    if (lastPosition == null) lastPosition = 0;
    if (len <= MAX_FACEBOOK_OPTIONS) return data;

    positionsToMove = lastPosition + 9;
    list = data.slice(lastPosition, positionsToMove)

    if (positionsToMove < len) list.push(FB_MOVE_TO_RIGHT);
    if (lastPosition > 0) list.unshift(FB_MOVE_TO_LEFT);

    return list;
}

function getOrgUnitId (OUs, ou_name) {
    if (ou_name.length >= 20)
        ou_name = ou_name.substring(0, ou_name.length -3);
    return OUs.find(ou => ou.name.includes(ou_name));
}

function getInternetAttachment() {
    // NOTE: The contentUrl must be HTTPS.
    return {
        name: 'ChatbotPolicy.pdf',
        contentType: 'application/pdf',
        contentUrl: 'https://yesme.solidlines.io/ChatbotPolicy.pdf'
    };
}

async function saveProfile(profile) {

    var session_url = 'http://'+endpointConfig.middlewareHost+':'+endpointConfig.middlewarePort+'/profile/'+profile.facebookID;
    
    return axios.post(session_url, {}, {
        auth: {
          username: endpointConfig.middlewareUser,
          password: endpointConfig.middlewarePassword
        }
      }).then(function(response) {
        console.log('Authenticated');
      }).catch(function(error) {
        console.log('Error on Authentication');
      });
}

async function saveOrgUnit(profile) {

    var session_url = 'http://'+endpointConfig.middlewareHost+':'+endpointConfig.middlewarePort+'/profile/'+profile.facebookID + '/ou_uid/' + profile.userOrgUnit;
    console.log(session_url);
    
    axios.post(session_url, {}, {
        auth: {
          username: endpointConfig.middlewareUser,
          password: endpointConfig.middlewarePassword
        }
      }).then(function(response) {
        console.log('Authenticated');
      }).catch(function(error) {
        console.log('Error on Authentication');
      });
}

async function saveDataValue(profile, uid, value) {
    var session_url = 'http://'+endpointConfig.middlewareHost+':'+endpointConfig.middlewarePort+'/profile/'+profile.facebookID + '/dataCollectedFromBot';
    var payload = {};

    payload[uid] = value;
    
    axios.post(session_url, {}, {
        auth: {
          username: endpointConfig.middlewareUser,
          password: endpointConfig.middlewarePassword
        },
        data:payload
      }).then(function(response) {
        console.log('Authenticated');
      }).catch(function(error) {
        console.log('Error on Authentication');
      });
}

async function sendToDhis2(profile) {
    var session_url = 'http://'+endpointConfig.middlewareHost+':'+endpointConfig.middlewarePort+'/sendToDhis2/'+profile.facebookID;

    axios.post(session_url, {}, {
        auth: {
          username: endpointConfig.middlewareUser,
          password: endpointConfig.middlewarePassword
        }
      }).then(function(response) {
        console.log('Authenticated');
      }).catch(function(error) {
        console.log('Error on Authentication');
      });
}

async function getChilrenOU(profile) {
    var session_url = 'http://'+endpointConfig.middlewareHost+':'+endpointConfig.middlewarePort+'/getChildrenOU/'+profile.userOrgUnit;

    try {
        return await axios.get(session_url,{
            auth: {
              username: endpointConfig.middlewareUser,
              password: endpointConfig.middlewarePassword
            }
          })
      } catch (error) {
        console.error(error)
    }
}

async function getProfile(profile) {
    var session_url = 'http://'+endpointConfig.middlewareHost+':'+endpointConfig.middlewarePort+'/profile/'+profile.facebookID;

    console.log (session_url);

    try {
        return await axios.get(session_url,{
            auth: {
              username: endpointConfig.middlewareUser,
              password: endpointConfig.middlewarePassword
            }
          })
      } catch (error) {
        console.error(error);
        return error;
    }
}


module.exports = {questionFirstName, saveAndValidateFirstName, questionLastName, saveAndValidateLastName, questionGender, 
    saveAndValidateGender, questionDateOfBirth, saveAndValidateDateOfBirth, questionPresentAddress, saveAndValidatePresentAddress,
    questionPermanentAddress, saveAndValidatePermanentAddress, questionContactNumber, saveAndValidateContactNumber,
    questionDisability, saveAndValidateDisability, questionDisability1, saveAndValidateDisability1,
    questionDisability2, saveAndValidateDisability2, questionDisability3, saveAndValidateDisability3,
    questionDisability4, saveAndValidateDisability4, questionDisability5, saveAndValidateDisability5, 
    questionDisability6, saveAndValidateDisability6, questionBelow21Years, validateBelow21Years, questionGuardian, saveAndValidateGuardian,
    questionGuardianDetails1, saveAndValidateGuardianDetails1, questionGuardianDetails2, saveAndValidateGuardianDetails2, questionGuardianDetails3, saveAndValidateGuardianDetails3,
    questionGuardianDetails4, saveAndValidateGuardianDetails4, questionGuardianDetails5, saveAndValidateGuardianDetails5, 
    questionGuardianDetails6, saveAndValidateGuardianDetails6, questionMaritalStatus, saveAndValidateMaritalStatus, questionPartnerName, saveAndValidatePartnerName,
    questionPartnerOccupation, saveAndValidatePartnerOccupation, questionPartnerContactNumber, saveAndValidatePartnerContactNumber,
    questionChildren, saveAndValidateChildren, questionNumberChildren, saveAndValidateNumberChildren, questionChildrenAge, saveAndValidateChildrenAge, 
    questionChildrenGender, saveAndValidateChildrenGender, questionStudying, saveAndValidateStudying, questionEmployed, saveAndValidateEmployed,
    questionInterests, saveAndValidateInterests, questionHighestEducation, saveAndValidateHighestEducation, questionYearGraduated, saveAndValidateYearGraduated,
    questionStopEducation, saveAndValidateStopEducation, questionMemberOrganisation, saveAndValidateMemberOrganisation,
    questionOrganisationName, saveAndValidateOrganisationName, questionPosition, saveAndValidatePosition,
    questionYearsMembership, saveAndValidateYearsMembership, questionRecreations, saveAndValidateRecreations, questionPolicy, validatePolicy, 
    finish, questionOrgUnit, finishNoSave, questionDonor, saveAndValidateDonor, initProfile, questionCountry, validateCountry,
    questionLanguage, validateLanguage, questionUserExist, validateUserExist};