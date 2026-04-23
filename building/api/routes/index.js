const express = require('express');
const jobs = require('./jobs');
const signing = require('./signing');
const sessions = require('./sessions');
const customers = require('./customers');

const router = express.Router();

router.use('/jobs', jobs);
router.use('/deployments', require('./deployments'));
router.use('/pipelines', require('./pipelines'));
router.use('/actions', require('./actions'));
router.use('/builds', require('./builds'));
router.use('/signing-profiles', signing);
router.use('/sessions', sessions);
router.use('/customers', customers);
router.use('/runners', require('./runners'));
router.use('/admin', require('./admin'));
router.use('/vault', require('./vault'));

module.exports = router;
module.exports.internal = require('./internal');
