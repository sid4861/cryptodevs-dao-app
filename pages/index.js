import Head from 'next/head'
import Image from 'next/image'
import { useEffect, useState } from 'react'
import styles from '../styles/Home.module.css'
import {
  CRYPTODEVS_DAO_ABI,
  CRYPTODEVS_DAO_CONTRACT_ADDRESS,
  CRYPTODEVS_NFT_ABI,
  CRYPTODEVS_NFT_CONTRACT_ADDRESS,
} from "../constants";
import { Contract, ethers, providers } from 'ethers';
import * as constants from "../constants";

export default function Home() {

  const [connectedAccount, setConnectedAccount] = useState("");
  const [nftBalance, setNftBalance] = useState(0);
  const [treasuryBalance, setTreasuryBalance] = useState(0);
  const [numProposals, setNumProposals] = useState("");
  const [selectedTab, setSelectedTab] = useState("");
  const [fakeNftTokenId, setFakeNftTokenId] = useState("");
  const [loading, setLoading] = useState(false);
  const [proposals, setProposals] = useState([]);

  async function checkIfMetamaskIsConnected() {
    try {
      const { ethereum } = window;
      if (!ethereum) {
        alert("Please install metamask browser extention");
      } else {
        const accounts = await ethereum.request({ method: "eth_accounts" });
        if (accounts.length > 0) {
          setConnectedAccount(accounts[0]);
        }
      }
    } catch (error) {
      console.log(error);
    }
  }

  async function connectMetamask() {
    try {
      const { ethereum } = window;
      if (!ethereum) {
        alert("Please install metamask browser extension");
      } else {
        const accounts = await ethereum.request({ method: "eth_requestAccounts" });
        setConnectedAccount(accounts[0]);
      }
    } catch (error) {
      console.log(error);
    }
  }

  async function getProviderOrSigner(needSigner = false) {
    try {
      const { ethereum } = window;
      if (!ethereum) {
        alert("Please install metamask browser extension");
      } else {
        const provider = new providers.Web3Provider(ethereum);
        const { chainId } = await provider.getNetwork();
        if (chainId !== 4) {
          alert("Please connect to rinkeby network");
        }
        if (needSigner) {
          const signer = provider.getSigner();
          return signer;
        }
        return provider;
      }
    } catch (error) {
      console.log(error);
    }
  }

  // Render the contents of the appropriate tab based on `selectedTab`
  function renderTabs() {
    if (selectedTab === "Create Proposal") {
      return renderCreateProposalTab();
    } else if (selectedTab === "View Proposals") {
      return renderViewProposalsTab();
    }
    return null;
  }

  // Renders the 'Create Proposal' tab content
  function renderCreateProposalTab() {
    if (loading) {
      return (
        <div className={styles.description}>
          Loading... Waiting for transaction...
        </div>
      );
    } else if (nftBalance === 0) {
      return (
        <div className={styles.description}>
          You do not own any CryptoDevs NFTs. <br />
          <b>You cannot create or vote on proposals</b>
        </div>
      );
    } else {
      return (
        <div className={styles.container}>
          <label>Fake NFT Token ID to Purchase: </label>
          <input
            placeholder="0"
            type="number"
            onChange={(e) => setFakeNftTokenId(e.target.value)}
          />
          <button className={styles.button2} onClick={createProposal}>
            Create
          </button>
        </div>
      );
    }
  }

  // Renders the 'View Proposals' tab content
  function renderViewProposalsTab() {
    if (loading) {
      return (
        <div className={styles.description}>
          Loading... Waiting for transaction...
        </div>
      );
    } else if (proposals.length === 0) {
      return (
        <div className={styles.description}>
          No proposals have been created
        </div>
      );
    } else {
      return (
        <div>
          {proposals.map((p, index) => (
            <div key={index} className={styles.proposalCard}>
              <p>Proposal ID: {p.proposalId}</p>
              <p>Fake NFT to Purchase: {p.nftTokenId}</p>
              <p>Deadline: {p.deadline.toLocaleString()}</p>
              <p>Yay Votes: {p.yayVotes}</p>
              <p>Nay Votes: {p.nayVotes}</p>
              <p>Executed?: {p.executed.toString()}</p>
              {p.deadline.getTime() > Date.now() && !p.executed ? (
                <div className={styles.flex}>
                  <button
                    className={styles.button2}
                    onClick={() => voteOnProposal(p.proposalId, "YAY")}
                  >
                    Vote YAY
                  </button>
                  <button
                    className={styles.button2}
                    onClick={() => voteOnProposal(p.proposalId, "NAY")}
                  >
                    Vote NAY
                  </button>
                </div>
              ) : p.deadline.getTime() < Date.now() && !p.executed ? (
                <div className={styles.flex}>
                  <button
                    className={styles.button2}
                    onClick={() => executeProposal(p.proposalId)}
                  >
                    Execute Proposal{" "}
                    {p.yayVotes > p.nayVotes ? "(YAY)" : "(NAY)"}
                  </button>
                </div>
              ) : (
                <div className={styles.description}>Proposal Executed</div>
              )}
            </div>
          ))}
        </div>
      );
    }
  }

  // Reads the number of proposals in the DAO contract and sets the `numProposals` state variable
  async function getNumProposalsInDAO() {
    try {
      const provider = await getProviderOrSigner();
      const daoContract = getDaoContractInstance(provider);
      const numProposals = await daoContract.numProposals();
      setNumProposals(numProposals.toString());

    } catch (error) {
      console.log(error);
    }
  }

  // Helper function to return a DAO Contract instance
  // given a Provider/Signer
  function getDaoContractInstance(providerOrSigner) {
    return new Contract(constants.CRYPTODEVS_DAO_CONTRACT_ADDRESS, constants.CRYPTODEVS_DAO_ABI, providerOrSigner);
  }

  function getCryptodevsNFTContractInstance(providerOrSigner) {
    return new Contract(constants.CRYPTODEVS_NFT_CONTRACT_ADDRESS, constants.CRYPTODEVS_NFT_ABI, providerOrSigner);
  }

  // Calls the `voteOnProposal` function in the contract, using the passed
  // proposal ID and Vote
  async function voteOnProposal(proposalId, _vote) {
    try {
      const signer = await getProviderOrSigner(true);
      const daoContract = getDaoContractInstance(signer);

      let vote = _vote === "YAY" ? 0 : 1;

      const tx = await daoContract.voteOnProposal(proposalId, vote);
      setLoading(true);
      await tx.wait();
      setLoading(false);
      await fetchAllProposals();

    } catch (error) {
      console.log(error);
      window.alert(error.data.message);
    }
  }

  // Runs a loop `numProposals` times to fetch all proposals in the DAO
  // and sets the `proposals` state variable
  async function fetchAllProposals() {
    try {
      const proposals = [];
      for (let i = 0; i < numProposals; i++) {
        console.log({i});
        const proposal = await fetchProposalById(i);
        console.log({proposal});
        proposals.push(proposal);
      }
      setProposals(proposals);
      return proposals;
    } catch (error) {
      console.log(error);
      window.alert(error.data.message)
    }
  }

  // Helper function to fetch and parse one proposal from the DAO contract
  // Given the Proposal ID
  // and converts the returned data into a Javascript object with values we can use
  async function fetchProposalById(id) {
    try {
      const provider = await getProviderOrSigner();
      const contract = getDaoContractInstance(provider);
      const proposal = await contract.proposals(id);
      const parsedProposal = {
        proposalId: id,
        nftTokenId: proposal.nftTokenId.toString(),
        deadline: new Date(parseInt(proposal.deadline.toString()) * 1000),
        yayVotes: proposal.yayVotes.toString(),
        nayVotes: proposal.nayVotes.toString(),
        executed: proposal.executed
      }
      return parsedProposal;
    } catch (error) {

    }
  }

  // Calls the `executeProposal` function in the contract, using
  // the passed proposal ID
  async function executeProposal(proposalId) {
    try {
      const signer = await getProviderOrSigner(true);
      const daoContract = getDaoContractInstance(signer);
      const txn = await daoContract.executeProposal(proposalId);
      setLoading(true);
      await txn.wait();
      setLoading(false);
      await fetchAllProposals();
    } catch (error) {

    }
  }

  // Calls the `createProposal` function in the contract, using the tokenId from `fakeNftTokenId`
  async function createProposal() {
    try {
      const signer = await getProviderOrSigner(true);
      const daoContract = getDaoContractInstance(signer);
      const tx = await daoContract.createProposal(fakeNftTokenId);
      setLoading(true);
      await tx.wait();
      await getNumProposalsInDAO();
      setLoading(false);

    } catch (error) {
      console.log(error);
      // window.alert(error.data.message);
    }
  }

  // Reads the ETH balance of the DAO contract and sets the `treasuryBalance` state variable
  async function getDAOTreasuryBalance() {
    try {
      const provider = await getProviderOrSigner();
      const daoContractBalance = await provider.getBalance(constants.CRYPTODEVS_DAO_CONTRACT_ADDRESS);
      setTreasuryBalance(daoContractBalance.toString());
    } catch (error) {
      console.log(error);
    }
  }

  async function getUserNFTBalance() {
    try {
      const signer = await getProviderOrSigner(true);
      const nftContract = getCryptodevsNFTContractInstance(signer);
      const nftBalance = await nftContract.balanceOf(signer.getAddress());
      setNftBalance(parseInt(nftBalance.toString()));
    } catch (error) {
      console.log(error);
    }
  }

  useEffect(async () => {
    if (selectedTab === "View Proposals") {
      console.log("inside use effect");
      await fetchAllProposals();
    }
  }, [selectedTab]);

  useEffect(() => {
    checkIfMetamaskIsConnected();
  }, []);

  useEffect(() => {
    if (connectedAccount !== "") {
      getDAOTreasuryBalance();
      getUserNFTBalance();
      getNumProposalsInDAO();
    }
  }, [connectedAccount]);

  return (
    <div>
      <Head>
        <title>CryptoDevs DAO</title>
        <meta name="description" content="CryptoDevs DAO" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <div className={styles.main}>
        <div>
          <h1 className={styles.title}>Welcome to Crypto Devs!</h1>
          <div className={styles.description}>Welcome to the DAO!</div>
          <div className={styles.description}>
            Your CryptoDevs NFT Balance: {nftBalance}
            <br />
            Treasury Balance: {ethers.utils.formatEther(treasuryBalance)} ETH
            <br />
            Total Number of Proposals: {numProposals}
          </div>
          {
            connectedAccount === ""
              ?
              <button className={styles.button} onClick={connectMetamask} >Connect wallet</button>
              :
              <div className={styles.flex}>
                <button
                  className={styles.button}
                  onClick={() => setSelectedTab("Create Proposal")}
                >
                  Create Proposal
                </button>
                <button
                  className={styles.button}
                  onClick={() => setSelectedTab("View Proposals")}
                >
                  View Proposals
                </button>
              </div>
          }

          {
            renderTabs()
          }
        </div>
        <div>
        </div>
        <div>
          <img className={styles.image} src="/cryptodevs/vercel.svg" />
        </div>
      </div>

      <footer className={styles.footer}>
        Made with &#10084; by Crypto Devs
      </footer>
    </div>
  )
}
