import bodyParser from "body-parser";
import express from "express";
import { BASE_NODE_PORT } from "../config";
import { Value } from "../types";
import { delay } from "../utils";

type NodeState = {
  killed: boolean;
  x: 0 | 1 | "?" | null;
  decided: boolean | null;
  k: number | null;
};

export async function node(
  nodeId: number,
  N: number,
  F: number,
  initialValue: Value,
  isFaulty: boolean,
  nodesAreReady: () => boolean,
  setNodeIsReady: (index: number) => void
) {
  const app = express();
  app.use(express.json());
  app.use(bodyParser.json());

  

  app.get('/status', (req, res) => {
    res.status(isFaulty ? 500 : 200).send(isFaulty ? 'faulty' : 'live');
  });

  app.get("/start", async (req, res) => {
    while (!nodesAreReady()) {
      await delay(50);
    }

    if (!isFaulty) {
      currentState = {killed: false, x: initialValue,decided: false, k: 1,};

      for (let i = 0; i < N; i++) {
        send(BASE_NODE_PORT + i, {k: currentState.k,x: currentState.x, type: "propose",});
      }
    } else {
      currentState = {killed: false,x: null,decided: null,k: null,};
    }

    res.status(200).send("ok");
  });

  let proposals: Map<number, Value[]> = new Map();
  let votes: Map<number, Value[]> = new Map();

  let currentState: NodeState = {killed: false,x: initialValue,decided: false,k: 0};
  app.get("/stop", async (req, res) => {currentState.killed = true;currentState.x = null;currentState.decided = null;currentState.k = 0;
    res.send("Node stop");
  });
  app.post("/message", async (req, res) => {
    const { k: K, x: X, type: messageType } = req.body;

    if (!currentState.killed && !isFaulty) {
      if (messageType === "propose") {
        handleProposeMessage(K, X);
      } else if (messageType === "vote") {
        handleVoteMessage(K, X);
      }
    }

    res.status(200).send("ok");
  });

  app.get("/getState", (req, res) => res.send(isFaulty ? {killed: currentState.killed, x: null, decided: null, k: null} : currentState));

  const server = app.listen(BASE_NODE_PORT + nodeId, async () => {
    console.log(`Node ${nodeId} is listening on port ${BASE_NODE_PORT + nodeId}`);

    setNodeIsReady(nodeId);
  });

  
  return server;
  function handleVoteMessage(K: number, X: Value) {
    if (!votes.has(K)) {
      votes.set(K, []);
    }
    votes.get(K)!.push(X);

    const vote = votes.get(K)!;
    if (vote.length >= N - F) {
      const Count0 = vote.filter((x) => x === 0).length;
      const Count1 = vote.filter((x) => x === 1).length;

      if (Count0 >= F + 1) {
        currentState.x = 0;
        currentState.decided = true;
      } else if (Count1 >= F + 1) {
        currentState.x = 1;
        currentState.decided = true;
      } else {
        
        
        let nvX: 0 | 1;
        if (Count0 + Count1 > 0 && Count0 > Count1) {
          nvX = 0;
      } else if (Count0 + Count1 > 0 && Count0 < Count1) {
          nvX = 1;
      } else if (Math.random() > 0.5) {
          nvX = 0;
      } else {
          nvX = 1;
      }
        currentState.x = nvX;
        currentState.k = K + 1;

        for (let i = 0; i < N; i++) {
          send(BASE_NODE_PORT + i, {k: currentState.k,x: currentState.x,type: "propose",
          });
        }
      }
    }
  }
  function handleProposeMessage(K: number, X: Value) {
    if (!proposals.has(K)) {
      proposals.set(K, []);
    }
    proposals.get(K)!.push(X);
    const proposal = proposals.get(K)!;
    if (proposal.length >= N - F) {
      const Count0 = proposal.filter((x) => x === 0).length;
      const Count1 = proposal.filter((x) => x === 1).length;
  
      let nvX;
      if (Count0 > N / 2) {
          nvX = 0;
      } else if (Count1 > N / 2) {
          nvX = 1;
      } else {
         
          nvX = 0; 
      }
  
      for (let i = 0; i < N; i++) {
          send(BASE_NODE_PORT + i, { k: K, x: nvX, type: "vote" });
      }
  }
  }

  

  function send(port: number, message: any) {
    fetch(`http://localhost:${port}/message`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(message),
    });
  }
  
}