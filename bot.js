const { ActivityTypes, ActivityHandler } = require("botbuilder");
const question = require('./flow.json');
const workflow = require('./workflow');

// Read log file path from .env file
// Note: Ensure you have a .env file and include log path
const dotenv = require('dotenv');
const path = require('path');
const ENV_FILE = path.join(__dirname, '.env');
dotenv.config({ path: ENV_FILE });

// shared variables
var endpointConfig;


class YesMeBot extends ActivityHandler {
    constructor(conversationState, userState, _endpointConfig) {
        super();
        // The accessor names for the conversation flow and user profile state property accessors.
        const CONVERSATION_FLOW_PROPERTY = 'conversationFlowProperty';
        const USER_PROFILE_PROPERTY = 'userProfileProperty';
        // The state property accessors for conversation flow and user profile.
        this.conversationFlow = conversationState.createProperty(CONVERSATION_FLOW_PROPERTY);
        this.userProfileAccessor = userState.createProperty(USER_PROFILE_PROPERTY);
        // The state management objects for the conversation and user.
        this.conversationState = conversationState;
        this.userState = userState;
        // Configuracion file of the bot
        endpointConfig = _endpointConfig;
    }

    async onTurn(turnContext) {
        // This bot listens for message activities.
        if (turnContext.activity.type === ActivityTypes.Message) {

            // Set text to null in case of "images", "like", "gif", "file attached"...
            if (Object.prototype.hasOwnProperty.call(turnContext, 'attachments')) {
                turnContext.activity.text = null;
            }

            // Get the state properties from the turn context.
            const flow = await this.conversationFlow.get(turnContext, { nextQuestion: question.welcome });
            const profile = await this.userProfileAccessor.get(turnContext, {});

            await YesMeBot.fillOutUserRegistration(flow, profile, turnContext);

            // Update state and save changes.
            await this.conversationFlow.set(turnContext, flow);
            await this.conversationState.saveChanges(turnContext);

            await this.userProfileAccessor.set(turnContext, profile);
            await this.userState.saveChanges(turnContext);
        }
    }

    static async fillOutUserRegistration(flow, profile, turnContext) {

        switch (flow.nextQuestion) {

            case question.welcome: {
                await workflow.initProfile(flow, profile, turnContext, endpointConfig);
                await YesMeBot.fillOutUserRegistration(flow, profile, turnContext);
                break;
            }

            case question.language: {
                await workflow.questionLanguage(flow, turnContext, profile);
                break;
            }

            case question.validateLanguage: {
                await workflow.validateLanguage(flow, turnContext, profile);
                await YesMeBot.fillOutUserRegistration(flow, profile, turnContext);
                break;
            }

            case question.policy: {
                await workflow.questionPolicy(flow, turnContext, profile);
                break;
            }

            case question.validatePolicy: {
                await workflow.validatePolicy(flow, turnContext, profile);
                await YesMeBot.fillOutUserRegistration(flow, profile, turnContext);
                break;
            }

            case question.userExist: {
                await workflow.questionUserExist(flow, turnContext, profile);
                break;
            }

            case question.validateUserExist: {
                await workflow.validateUserExist(flow, turnContext, profile);
                await YesMeBot.fillOutUserRegistration(flow, profile, turnContext);
                break;
            }

            case question.country: {
                await workflow.questionCountry(flow, turnContext, profile);
                break;
            }

            case question.validateCountry: {
                await workflow.validateCountry(flow, turnContext, profile);
                await YesMeBot.fillOutUserRegistration(flow, profile, turnContext);
                break;
            }

            case question.orgunit: {
                await workflow.questionOrgUnit(flow, turnContext, profile);
                if (flow.nextQuestion == question.donor) {
                    await YesMeBot.fillOutUserRegistration(flow, profile, turnContext);
                }
                break;
            }

            case question.donor: {
                await workflow.questionDonor(flow, turnContext, profile);
                break;
            }

            case question.saveAndValidateDonor: {
                await workflow.saveAndValidateDonor(flow, turnContext, profile);
                await YesMeBot.fillOutUserRegistration(flow, profile, turnContext);
                break;
            }

            case question.firstName: {
                await workflow.questionFirstName(flow, turnContext, profile);
                break;
            }

            case question.saveAndValidateFirstName: {
                await workflow.saveAndValidateFirstName(flow, turnContext, profile);
                await YesMeBot.fillOutUserRegistration(flow, profile, turnContext);
                break;
            }

            case question.lastName: {
                await workflow.questionLastName(flow, turnContext, profile);
                break;
            }

            case question.saveAndValidateLastName: {
                await workflow.saveAndValidateLastName(flow, turnContext, profile);
                await YesMeBot.fillOutUserRegistration(flow, profile, turnContext);
                break;
            }

            case question.gender: {
                await workflow.questionGender(flow, turnContext, profile);
                break;
            }

            case question.saveAndValidateGender: {
                await workflow.saveAndValidateGender(flow, turnContext, profile);
                await YesMeBot.fillOutUserRegistration(flow, profile, turnContext);
                break;
            }

            case question.dateOfBirth: {
                await workflow.questionDateOfBirth(flow, turnContext, profile);
                break;
            }

            case question.saveAndValidateDateOfBirth: {
                await workflow.saveAndValidateDateOfBirth(flow, turnContext, profile);
                await YesMeBot.fillOutUserRegistration(flow, profile, turnContext);
                break;
            }

            case question.presentAddress: {
                await workflow.questionPresentAddress(flow, turnContext, profile);
                break;
            }

            case question.saveAndValidatePresentAddress: {
                await workflow.saveAndValidatePresentAddress(flow, turnContext, profile);
                await YesMeBot.fillOutUserRegistration(flow, profile, turnContext);
                break;
            }

            case question.permanentAddress: {
                await workflow.questionPermanentAddress(flow, turnContext, profile);
                break;
            }

            case question.saveAndValidatePermanentAddress: {
                await workflow.saveAndValidatePermanentAddress(flow, turnContext, profile);
                await YesMeBot.fillOutUserRegistration(flow, profile, turnContext);
                break;
            }

            case question.contactNumber: {
                await workflow.questionContactNumber(flow, turnContext, profile);
                break;
            }

            case question.saveAndValidateContactNumber: {
                await workflow.saveAndValidateContactNumber(flow, turnContext, profile);
                await YesMeBot.fillOutUserRegistration(flow, profile, turnContext);
                break;
            }

            case question.disability: {
                await workflow.questionDisability(flow, turnContext, profile);
                break;
            }

            case question.saveAndValidateDisability: {
                await workflow.saveAndValidateDisability(flow, turnContext, profile);
                await YesMeBot.fillOutUserRegistration(flow, profile, turnContext);
                break;
            }

            case question.disability1: {
                await workflow.questionDisability1(flow, turnContext, profile);
                break;
            }

            case question.saveAndValidateDisability1: {
                await workflow.saveAndValidateDisability1(flow, turnContext, profile);
                await YesMeBot.fillOutUserRegistration(flow, profile, turnContext);
                break;
            }
            case question.disability2: {
                await workflow.questionDisability2(flow, turnContext, profile);
                break;
            }

            case question.saveAndValidateDisability2: {
                await workflow.saveAndValidateDisability2(flow, turnContext, profile);
                await YesMeBot.fillOutUserRegistration(flow, profile, turnContext);
                break;
            }
            case question.disability3: {
                await workflow.questionDisability3(flow, turnContext, profile);
                break;
            }

            case question.saveAndValidateDisability3: {
                await workflow.saveAndValidateDisability3(flow, turnContext, profile);
                await YesMeBot.fillOutUserRegistration(flow, profile, turnContext);
                break;
            }
            case question.disability4: {
                await workflow.questionDisability4(flow, turnContext, profile);
                break;
            }

            case question.saveAndValidateDisability4: {
                await workflow.saveAndValidateDisability4(flow, turnContext, profile);
                await YesMeBot.fillOutUserRegistration(flow, profile, turnContext);
                break;
            }
            case question.disability5: {
                await workflow.questionDisability5(flow, turnContext, profile);
                break;
            }

            case question.saveAndValidateDisability5: {
                await workflow.saveAndValidateDisability5(flow, turnContext, profile);
                await YesMeBot.fillOutUserRegistration(flow, profile, turnContext);
                break;
            }

            case question.disability6: {
                await workflow.questionDisability6(flow, turnContext, profile);
                break;
            }

            case question.saveAndValidateDisability6: {
                await workflow.saveAndValidateDisability6(flow, turnContext, profile);
                await YesMeBot.fillOutUserRegistration(flow, profile, turnContext);
                break;
            }

            case question.below21Years: {
                await workflow.questionBelow21Years(flow, turnContext, profile);
                break;
            }

            case question.validate21Years: {
                await workflow.validateBelow21Years(flow, turnContext, profile);
                await YesMeBot.fillOutUserRegistration(flow, profile, turnContext);
                break;
            }

            case question.guardian: {
                await workflow.questionGuardian(flow, turnContext, profile);
                break;
            }

            case question.saveAndValidateGuardian: {
                await workflow.saveAndValidateGuardian(flow, turnContext, profile);
                await YesMeBot.fillOutUserRegistration(flow, profile, turnContext);
                break;
            }

            case question.guardianDetails1: {
                await workflow.questionGuardianDetails1(flow, turnContext, profile);
                break;
            }

            case question.saveAndValidateGuardianDetails1: {
                await workflow.saveAndValidateGuardianDetails1(flow, turnContext, profile);
                await YesMeBot.fillOutUserRegistration(flow, profile, turnContext);
                break;
            }

            case question.guardianDetails2: {
                await workflow.questionGuardianDetails2(flow, turnContext, profile);
                break;
            }

            case question.saveAndValidateGuardianDetails2: {
                await workflow.saveAndValidateGuardianDetails2(flow, turnContext, profile);
                await YesMeBot.fillOutUserRegistration(flow, profile, turnContext);
                break;
            }
            case question.guardianDetails3: {
                await workflow.questionGuardianDetails3(flow, turnContext, profile);
                break;
            }

            case question.saveAndValidateGuardianDetails3: {
                await workflow.saveAndValidateGuardianDetails3(flow, turnContext, profile);
                await YesMeBot.fillOutUserRegistration(flow, profile, turnContext);
                break;
            }
            case question.guardianDetails4: {
                await workflow.questionGuardianDetails4(flow, turnContext, profile);
                break;
            }

            case question.saveAndValidateGuardianDetails4: {
                await workflow.saveAndValidateGuardianDetails4(flow, turnContext, profile);
                await YesMeBot.fillOutUserRegistration(flow, profile, turnContext);
                break;
            }
            case question.guardianDetails5: {
                await workflow.questionGuardianDetails5(flow, turnContext, profile);
                break;
            }

            case question.saveAndValidateGuardianDetails5: {
                await workflow.saveAndValidateGuardianDetails5(flow, turnContext, profile);
                await YesMeBot.fillOutUserRegistration(flow, profile, turnContext);
                break;
            }

            case question.guardianDetails6: {
                await workflow.questionGuardianDetails6(flow, turnContext, profile);
                break;
            }

            case question.saveAndValidateGuardianDetails6: {
                await workflow.saveAndValidateGuardianDetails6(flow, turnContext, profile);
                await YesMeBot.fillOutUserRegistration(flow, profile, turnContext);
                break;
            }

            case question.maritalStatus: {
                await workflow.questionMaritalStatus(flow, turnContext, profile);
                break;
            }

            case question.saveAndValidateMaritalStatus: {
                await workflow.saveAndValidateMaritalStatus(flow, turnContext, profile);
                await YesMeBot.fillOutUserRegistration(flow, profile, turnContext);
                break;
            }

            case question.partnerName: {
                await workflow.questionPartnerName(flow, turnContext, profile);
                break;
            }

            case question.saveAndValidatePartnerName: {
                await workflow.saveAndValidatePartnerName(flow, turnContext, profile);
                await YesMeBot.fillOutUserRegistration(flow, profile, turnContext);
                break;
            }

            case question.partnerOccupation: {
                await workflow.questionPartnerOccupation(flow, turnContext, profile);
                break;
            }

            case question.saveAndValidatePartnerOccupation: {
                await workflow.saveAndValidatePartnerOccupation(flow, turnContext, profile);
                await YesMeBot.fillOutUserRegistration(flow, profile, turnContext);
                break;
            }

            case question.partnerContactNumber: {
                await workflow.questionPartnerContactNumber(flow, turnContext, profile);
                break;
            }

            case question.saveAndValidatePartnerContactNumber: {
                await workflow.saveAndValidatePartnerContactNumber(flow, turnContext, profile);
                await YesMeBot.fillOutUserRegistration(flow, profile, turnContext);
                break;
            }

            case question.children: {
                await workflow.questionChildren(flow, turnContext, profile);
                break;
            }

            case question.saveAndValidateChildren: {
                await workflow.saveAndValidateChildren(flow, turnContext, profile);
                await YesMeBot.fillOutUserRegistration(flow, profile, turnContext);
                break;
            }

            case question.numberChildren: {
                await workflow.questionNumberChildren(flow, turnContext, profile);
                break;
            }

            case question.saveAndValidateNumberChildren: {
                await workflow.saveAndValidateNumberChildren(flow, turnContext, profile);
                await YesMeBot.fillOutUserRegistration(flow, profile, turnContext);
                break;
            }

            case question.childrenAge: {
                await workflow.questionChildrenAge(flow, turnContext, profile);
                break;
            }

            case question.saveAndValidateChildrenAge: {
                await workflow.saveAndValidateChildrenAge(flow, turnContext, profile);
                await YesMeBot.fillOutUserRegistration(flow, profile, turnContext);
                break;
            }

            case question.childrenGender: {
                await workflow.questionChildrenGender(flow, turnContext, profile);
                break;
            }

            case question.saveAndValidateChildrenGender: {
                await workflow.saveAndValidateChildrenGender(flow, turnContext, profile);
                await YesMeBot.fillOutUserRegistration(flow, profile, turnContext);
                break;
            }

            case question.studying: {
                await workflow.questionStudying(flow, turnContext, profile);
                break;
            }

            case question.saveAndValidateStudying: {
                await workflow.saveAndValidateStudying(flow, turnContext, profile);
                await YesMeBot.fillOutUserRegistration(flow, profile, turnContext);
                break;
            }

            case question.employed: {
                await workflow.questionEmployed(flow, turnContext, profile);
                break;
            }

            case question.saveAndValidateEmployed: {
                await workflow.saveAndValidateEmployed(flow, turnContext, profile);
                await YesMeBot.fillOutUserRegistration(flow, profile, turnContext);
                break;
            }

            case question.interests: {
                await workflow.questionInterests(flow, turnContext, profile);
                break;
            }

            case question.saveAndValidateInterests: {
                await workflow.saveAndValidateInterests(flow, turnContext, profile);
                await YesMeBot.fillOutUserRegistration(flow, profile, turnContext);
                break;
            }

            case question.highestEducation: {
                await workflow.questionHighestEducation(flow, turnContext, profile);
                break;
            }

            case question.saveAndValidateHighestEducation: {
                await workflow.saveAndValidateHighestEducation(flow, turnContext, profile);
                await YesMeBot.fillOutUserRegistration(flow, profile, turnContext);
                break;
            }

            case question.yearGraduated: {
                await workflow.questionYearGraduated(flow, turnContext, profile);
                break;
            }

            case question.saveAndValidateYearGraduated: {
                await workflow.saveAndValidateYearGraduated(flow, turnContext, profile);
                await YesMeBot.fillOutUserRegistration(flow, profile, turnContext);
                break;
            }

            case question.stopEducation: {
                await workflow.questionStopEducation(flow, turnContext, profile);
                break;
            }

            case question.saveAndValidateStopEducation: {
                await workflow.saveAndValidateStopEducation(flow, turnContext, profile);
                await YesMeBot.fillOutUserRegistration(flow, profile, turnContext);
                break;
            }

            case question.memberOrganisation: {
                await workflow.questionMemberOrganisation(flow, turnContext, profile);
                break;
            }

            case question.saveAndValidateMemberOrganisation: {
                await workflow.saveAndValidateMemberOrganisation(flow, turnContext, profile);
                await YesMeBot.fillOutUserRegistration(flow, profile, turnContext);
                break;
            }

            case question.organisationName: {
                await workflow.questionOrganisationName(flow, turnContext, profile);
                break;
            }

            case question.saveAndValidateOrganisationName: {
                await workflow.saveAndValidateOrganisationName(flow, turnContext, profile);
                await YesMeBot.fillOutUserRegistration(flow, profile, turnContext);
                break;
            }

            case question.position: {
                await workflow.questionPosition(flow, turnContext, profile);
                break;
            }

            case question.saveAndValidatePosition: {
                await workflow.saveAndValidatePosition(flow, turnContext, profile);
                await YesMeBot.fillOutUserRegistration(flow, profile, turnContext);
                break;
            }

            case question.yearsMembership: {
                await workflow.questionYearsMembership(flow, turnContext, profile);
                break;
            }

            case question.saveAndValidateYearsMembership: {
                await workflow.saveAndValidateYearsMembership(flow, turnContext, profile);
                await YesMeBot.fillOutUserRegistration(flow, profile, turnContext);
                break;
            }

            case question.recreations: {
                await workflow.questionRecreations(flow, turnContext, profile);
                break;
            }

            case question.saveAndValidateRecreations: {
                await workflow.saveAndValidateRecreations(flow, turnContext, profile);
                await YesMeBot.fillOutUserRegistration(flow, profile, turnContext);
                break;
            }

            case question.finish: {
                await workflow.finish(flow, turnContext, profile);
                if (flow.nextQuestion == question.finishDueToError){
                    await YesMeBot.fillOutUserRegistration(flow, profile, turnContext);
                }
                break;
            }

            case question.finishNoSave: {
                await workflow.finishNoSave(flow, turnContext, profile);
                break;
            }

            case question.finishDueToError: {
                await workflow.finishDueToError(flow, turnContext, profile);
                await YesMeBot.fillOutUserRegistration(flow, profile, turnContext);
                break;
            }
        }

    }
}



module.exports.YesMeBot = YesMeBot;