const assert = require('assert');
const expect = require('expect.js');

// const AWS = require('aws-sdk');
var AWS = require('aws-sdk-mock');
const utils = require('../lambda/utils');

// AWS SDK mocks
AWS.mock('Lambda', 'getAlias', {});
AWS.mock('Lambda', 'updateFunctionConfiguration', {});
AWS.mock('Lambda', 'publishVersion', {});
AWS.mock('Lambda', 'deleteFunction', {});
AWS.mock('Lambda', 'createAlias', {});
AWS.mock('Lambda', 'deleteAlias', {});
AWS.mock('Lambda', 'invoke', {});

// mock env variables and context
const powerValues = [128,256,512,1024]
process.env.powerValues = powerValues.join(',');
process.env.minRAM = 128;
process.env.minCost = 2.08e-7;
const fakeContext = {};

const invokeForSuccess = function(handler, event) {
    var err, data;
    function _cb (error, result) {
        //console.log("success cb", error, result);
        err = error;
        data = result;
    };
    return handler(event, fakeContext, _cb)
        .then(function() {
            expect(err).to.be(null);
            expect(data).to.not.be(null);
            return Promise.resolve(data);
        });
};
const invokeForFailure = function(handler, event) {
    var err, data;
    function _cb (error, result) {
        //console.log("failure cb", error, result);
        err = error;
        data = result;
    };
    return handler(event, fakeContext, _cb)
        .then(function() {
            expect(err).to.not.be(null);
            expect(data).to.be(null);
            return Promise.reject(err);
        });
};

describe('Lambda Functions', function() {

    describe('initializer', function() {

        const handler = require('../lambda/initializer').handler;

        var setLambdaPowerCounter,
            publishLambdaVersionCounter,
            createLambdaAliasCounter;

        beforeEach('mock utilities', function() {
            setLambdaPowerCounter = 0;
            publishLambdaVersionCounter = 0;
            createLambdaAliasCounter = 0;
            // TODO use real mock (not override!)
            utils.checkLambdaAlias = function() {
                return Promise.reject(new Error("Alias does not exist"));
            };
            utils.setLambdaPower = function() {
                setLambdaPowerCounter++;
                return Promise.resolve("OK");
            };
            utils.publishLambdaVersion = function() {
                publishLambdaVersionCounter++;
                return Promise.resolve({Version: 1});
            };
            utils.createLambdaAlias = function() {
                createLambdaAliasCounter++;
                return Promise.resolve("OK");
            };
        });

        it('should explode if invoked without a lambdaARN', function() {
            const invalidEvents = [
                null,
                {},
                {lambdaARN: null},
                {lambdaARN: ""},
                {lambdaARN: false},
                {lambdaARN: 0},
            ];
            invalidEvents.forEach(function(event) {
                expect(function() {
                    invokeForFailure(handler, event);
                }).to.throwError();
            });

            expect(function() {
                invokeForSuccess(handler, {lambdaARN: "arnOK"});
            }).to.not.throwError();

        });

        it('should invoke the given cb, when done', function() {
            return invokeForSuccess(handler, {lambdaARN: "arnOK"});
        });
        
        it('should create N aliases and verions', function() {
            return invokeForSuccess(handler, {lambdaARN: "arnOK"})
                .then(function() {
                    expect(setLambdaPowerCounter).to.be(powerValues.length);
                    expect(publishLambdaVersionCounter).to.be(powerValues.length);
                    expect(createLambdaAliasCounter).to.be(powerValues.length);
                });
        });
        
    });

    describe('cleaner', function() {

        const handler = require('../lambda/cleaner').handler;

        it('should explode if invoked without a lambdaARN', function() {
            const invalidEvents = [
                null,
                {},
                {lambdaARN: null},
                {lambdaARN: ""},
                {lambdaARN: false},
                {lambdaARN: 0},
            ];
            invalidEvents.forEach(function(event) {
                expect(function() {
                    invokeForFailure(handler, event);
                }).to.throwError();
            });
        });

        it('should invoke the given cb, when done', function() {
            return invokeForSuccess(handler, {lambdaARN: "arnOK"});
        });

    });

    describe('executor', function() {

        const handler = require('../lambda/executor').handler;

        var invokeLambdaCounter;

        beforeEach('mock utilities', function() {
            invokeLambdaCounter = 0;
            // TODO use real mock (not override!)
            utils.invokeLambda = function() {
                invokeLambdaCounter++;
                return Promise.resolve("OK");
            };
        });

        it('should explode if invoked with invalid input', function() {
            const invalidEvents = [
                null,
                {},
                {lambdaARN: null},
                {lambdaARN: ""},
                {lambdaARN: false},
                {lambdaARN: 0},
                {lambdaARN: "arnOK"},
                {lambdaARN: "arnOK", value: null},
                {lambdaARN: "arnOK", value: 0},
                {lambdaARN: "arnOK", value: "invalid"},
                {lambdaARN: "arnOK", value: 128},  // 128 is ok
                {lambdaARN: "arnOK", value: "128"},  // "128" is ok
                {lambdaARN: "arnOK", value: 128, num: null},
                {lambdaARN: "arnOK", value: 128, num: 0},
                {lambdaARN: "arnOK", value: 128, num: "invalid"},
            ];

            invalidEvents.forEach(function(event) {
                expect(function() {
                    invokeForFailure(handler, event);
                }).to.throwError();
            });
        });

        it('should invoke the given cb, when done', function() {
            return invokeForSuccess(handler, {
                lambdaARN: "arnOK",
                value: 128,
                num: 10,
            });
        });

        it('should invoke the given cb, when done (parallelInvocation)', function() {
            return invokeForSuccess(handler, {
                lambdaARN: "arnOK",
                value: 128,
                num: 10,
                parallelInvocation: true
            });
        });

        it('should invoke the given cb, when done (custom payload)', function() {
            return invokeForSuccess(handler, {
                lambdaARN: "arnOK",
                value: 128,
                num: 10,
                payload: {key1: "value1", key2: "value2"},
            });
        });

        [1, 10, 100].forEach(function(num) {
            it('should invoke Lambda '+ num +' time(s)', function() {
                return invokeForSuccess(handler, {
                    lambdaARN: "arnOK",
                    value: 128,
                    num: num,
                }).then(function() {
                    expect(invokeLambdaCounter).to.be(num);
                });
            });
            it('should invoke Lambda '+ num +' time(s) in parallel', function() {
                return invokeForSuccess(handler, {
                    lambdaARN: "arnOK",
                    value: 128,
                    num: num,
                    parallelInvocation: true,
                }).then(function() {
                    expect(invokeLambdaCounter).to.be(num);
                });
            });
        });

        it('should return value and price as output', function() {
            return invokeForSuccess(handler, {
                lambdaARN: "arnOK",
                value: 128,
                num: 10,
            }).then(function(output) {
                expect(output).to.be.an('object');
                expect(output.value).to.be.a('number');
                expect(output.price).to.be.a('number');
            });
        });

    });

});