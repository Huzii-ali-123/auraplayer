
import http from 'k6/http';
import { check, sleep } from 'k6';

const BASE_URL = 'http://127.0.0.1:4173';

export const options = {
  discardResponseBodies: true,

  stages: [
    { duration: '10s', target: 5 },
    { duration: '15s', target: 10 },
    { duration: '15s', target: 15 },
    { duration: '15s', target: 20 },
    { duration: '10s', target: 0 },
  ],

  thresholds: {
    http_req_failed: [
      {
        threshold: 'rate<0.01',
        abortOnFail: true,
        delayAbortEval: '5s',
      },
    ],
    http_req_duration: [
      {
        threshold: 'p(95)<2000',
        abortOnFail: true,
        delayAbortEval: '10s',
      },
    ],
  },
};

export default function () {
  const responses = http.batch([
    ['GET', `${BASE_URL}/`],
    ['GET', `${BASE_URL}/assets/index-Bti94Q19.js`],
    ['GET', `${BASE_URL}/assets/index-D6nvvrpy.css`],
  ]);

  check(responses[0], {
    'HTML loads': (r) => r.status === 200,
  });

  check(responses[1], {
    'JavaScript loads': (r) => r.status === 200,
  });

  check(responses[2], {
    'CSS loads': (r) => r.status === 200,
  });

  sleep(1);
}
