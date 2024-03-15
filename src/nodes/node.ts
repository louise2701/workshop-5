import express from 'express';
import http from 'http';
import { BASE_NODE_PORT } from '../config';
import { Value } from '../types';

type NodeState = {
  killed: boolean;
  x: Value | null;
  decided: boolean | null;
  k: number | null;
};

type Message = {
  sender: number;
  value: Value;
};

export async function node(
  nodeId: number,
  N: number,
  F: number,
  initialValue: Value,
  isFaulty: boolean,
  nodesAreReady: () => boolean,
  setNodeIsReady: (index: number) => void
): Promise<http.Server> {
  const app = express();
  app.use(express.json());

  let state: NodeState = {
    killed: false,
    x: initialValue,
    decided: false,
    k: null,
  };

  let messages: Message[] = [];

  app.get('/status', (req, res) => {
    res.status(isFaulty ? 500 : 200).send(isFaulty ? 'faulty' : 'live');
  });

  app.get('/getState', (req, res) => {
    res.status(200).send(state);
  });

  app.post('/message', (req, res) => {
    const { sender, value }: Message = req.body;
    messages.push({ sender, value });
    res.status(200).send('Message received');
  });

  app.get('/start', (req, res) => {
    if (nodesAreReady()) {
      state.k = 1;
     
      res.status(200).send('Consensus algorithm started');
    } else {
      res.status(500).send('Not all nodes are ready');
    }
  });

  app.get('/stop', (req, res) => {
    state.killed = true;
    res.status(200).send('Consensus algorithm stopped');
  });


  const server = app.listen(BASE_NODE_PORT + nodeId, () => {
    console.log(`Node ${nodeId} is listening on port ${BASE_NODE_PORT + nodeId}`);
    setNodeIsReady(nodeId);
  });

  return server;
}
