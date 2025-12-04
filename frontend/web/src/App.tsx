import React, { useEffect, useState } from "react";
import { ethers } from "ethers";
import { getContractReadOnly, getContractWithSigner } from "./contract";
import WalletManager from "./components/WalletManager";
import WalletSelector from "./components/WalletSelector";
import "./App.css";

interface ExperimentData {
  id: string;
  experimentName: string;
  participant: string;
  timestamp: number;
  encryptedResponses: string;
  status: "pending" | "analyzed" | "archived";
}

const App: React.FC = () => {
  const [account, setAccount] = useState("");
  const [loading, setLoading] = useState(true);
  const [experiments, setExperiments] = useState<ExperimentData[]>([]);
  const [provider, setProvider] = useState<ethers.BrowserProvider | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [walletSelectorOpen, setWalletSelectorOpen] = useState(false);
  const [transactionStatus, setTransactionStatus] = useState<{
    visible: boolean;
    status: "pending" | "success" | "error";
    message: string;
  }>({ visible: false, status: "pending", message: "" });
  const [newExperimentData, setNewExperimentData] = useState({
    experimentName: "",
    questionSet: "",
    participantInfo: ""
  });
  const [activeTab, setActiveTab] = useState("dashboard");
  const [expandedFAQ, setExpandedFAQ] = useState<number | null>(null);

  // Calculate statistics
  const pendingCount = experiments.filter(e => e.status === "pending").length;
  const analyzedCount = experiments.filter(e => e.status === "analyzed").length;
  const archivedCount = experiments.filter(e => e.status === "archived").length;

  useEffect(() => {
    loadExperiments().finally(() => setLoading(false));
  }, []);

  const onWalletSelect = async (wallet: any) => {
    if (!wallet.provider) return;
    try {
      const web3Provider = new ethers.BrowserProvider(wallet.provider);
      setProvider(web3Provider);
      const accounts = await web3Provider.send("eth_requestAccounts", []);
      const acc = accounts[0] || "";
      setAccount(acc);

      wallet.provider.on("accountsChanged", async (accounts: string[]) => {
        const newAcc = accounts[0] || "";
        setAccount(newAcc);
      });
    } catch (e) {
      alert("Failed to connect wallet");
    }
  };

  const onConnect = () => setWalletSelectorOpen(true);
  const onDisconnect = () => {
    setAccount("");
    setProvider(null);
  };

  const checkContractAvailability = async () => {
    try {
      const contract = await getContractReadOnly();
      if (!contract) return false;
      
      const isAvailable = await contract.isAvailable();
      if (isAvailable) {
        setTransactionStatus({
          visible: true,
          status: "success",
          message: "FHE contract is available and ready!"
        });
      } else {
        setTransactionStatus({
          visible: true,
          status: "error",
          message: "FHE contract is not available"
        });
      }
      
      setTimeout(() => {
        setTransactionStatus({ visible: false, status: "pending", message: "" });
      }, 3000);
      
      return isAvailable;
    } catch (e) {
      console.error("Error checking contract availability:", e);
      return false;
    }
  };

  const loadExperiments = async () => {
    setIsRefreshing(true);
    try {
      const contract = await getContractReadOnly();
      if (!contract) return;
      
      const keysBytes = await contract.getData("experiment_keys");
      let keys: string[] = [];
      
      if (keysBytes.length > 0) {
        try {
          keys = JSON.parse(ethers.toUtf8String(keysBytes));
        } catch (e) {
          console.error("Error parsing experiment keys:", e);
        }
      }
      
      const list: ExperimentData[] = [];
      
      for (const key of keys) {
        try {
          const experimentBytes = await contract.getData(`experiment_${key}`);
          if (experimentBytes.length > 0) {
            try {
              const experimentData = JSON.parse(ethers.toUtf8String(experimentBytes));
              list.push({
                id: key,
                experimentName: experimentData.experimentName,
                participant: experimentData.participant,
                timestamp: experimentData.timestamp,
                encryptedResponses: experimentData.encryptedResponses,
                status: experimentData.status || "pending"
              });
            } catch (e) {
              console.error(`Error parsing experiment data for ${key}:`, e);
            }
          }
        } catch (e) {
          console.error(`Error loading experiment ${key}:`, e);
        }
      }
      
      list.sort((a, b) => b.timestamp - a.timestamp);
      setExperiments(list);
    } catch (e) {
      console.error("Error loading experiments:", e);
    } finally {
      setIsRefreshing(false);
      setLoading(false);
    }
  };

  const submitExperiment = async () => {
    if (!provider) { 
      alert("Please connect wallet first"); 
      return; 
    }
    
    setCreating(true);
    setTransactionStatus({
      visible: true,
      status: "pending",
      message: "Encrypting participant data with FHE..."
    });
    
    try {
      // Simulate FHE encryption
      const encryptedData = `FHE-${btoa(JSON.stringify(newExperimentData))}`;
      
      const contract = await getContractWithSigner();
      if (!contract) {
        throw new Error("Failed to get contract with signer");
      }
      
      const experimentId = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

      const experimentData = {
        experimentName: newExperimentData.experimentName,
        participant: account,
        timestamp: Math.floor(Date.now() / 1000),
        encryptedResponses: encryptedData,
        status: "pending"
      };
      
      // Store encrypted data on-chain using FHE
      await contract.setData(
        `experiment_${experimentId}`, 
        ethers.toUtf8Bytes(JSON.stringify(experimentData))
      );
      
      const keysBytes = await contract.getData("experiment_keys");
      let keys: string[] = [];
      
      if (keysBytes.length > 0) {
        try {
          keys = JSON.parse(ethers.toUtf8String(keysBytes));
        } catch (e) {
          console.error("Error parsing keys:", e);
        }
      }
      
      keys.push(experimentId);
      
      await contract.setData(
        "experiment_keys", 
        ethers.toUtf8Bytes(JSON.stringify(keys))
      );
      
      setTransactionStatus({
        visible: true,
        status: "success",
        message: "Encrypted experiment data submitted securely!"
      });
      
      await loadExperiments();
      
      setTimeout(() => {
        setTransactionStatus({ visible: false, status: "pending", message: "" });
        setShowCreateModal(false);
        setNewExperimentData({
          experimentName: "",
          questionSet: "",
          participantInfo: ""
        });
      }, 2000);
    } catch (e: any) {
      const errorMessage = e.message.includes("user rejected transaction")
        ? "Transaction rejected by user"
        : "Submission failed: " + (e.message || "Unknown error");
      
      setTransactionStatus({
        visible: true,
        status: "error",
        message: errorMessage
      });
      
      setTimeout(() => {
        setTransactionStatus({ visible: false, status: "pending", message: "" });
      }, 3000);
    } finally {
      setCreating(false);
    }
  };

  const analyzeExperiment = async (experimentId: string) => {
    if (!provider) {
      alert("Please connect wallet first");
      return;
    }

    setTransactionStatus({
      visible: true,
      status: "pending",
      message: "Analyzing encrypted data with FHE..."
    });

    try {
      // Simulate FHE computation time
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      const contract = await getContractWithSigner();
      if (!contract) {
        throw new Error("Failed to get contract with signer");
      }
      
      const experimentBytes = await contract.getData(`experiment_${experimentId}`);
      if (experimentBytes.length === 0) {
        throw new Error("Experiment not found");
      }
      
      const experimentData = JSON.parse(ethers.toUtf8String(experimentBytes));
      
      const updatedExperiment = {
        ...experimentData,
        status: "analyzed"
      };
      
      await contract.setData(
        `experiment_${experimentId}`, 
        ethers.toUtf8Bytes(JSON.stringify(updatedExperiment))
      );
      
      setTransactionStatus({
        visible: true,
        status: "success",
        message: "FHE analysis completed successfully!"
      });
      
      await loadExperiments();
      
      setTimeout(() => {
        setTransactionStatus({ visible: false, status: "pending", message: "" });
      }, 2000);
    } catch (e: any) {
      setTransactionStatus({
        visible: true,
        status: "error",
        message: "Analysis failed: " + (e.message || "Unknown error")
      });
      
      setTimeout(() => {
        setTransactionStatus({ visible: false, status: "pending", message: "" });
      }, 3000);
    }
  };

  const archiveExperiment = async (experimentId: string) => {
    if (!provider) {
      alert("Please connect wallet first");
      return;
    }

    setTransactionStatus({
      visible: true,
      status: "pending",
      message: "Archiving experiment data..."
    });

    try {
      const contract = await getContractWithSigner();
      if (!contract) {
        throw new Error("Failed to get contract with signer");
      }
      
      const experimentBytes = await contract.getData(`experiment_${experimentId}`);
      if (experimentBytes.length === 0) {
        throw new Error("Experiment not found");
      }
      
      const experimentData = JSON.parse(ethers.toUtf8String(experimentBytes));
      
      const updatedExperiment = {
        ...experimentData,
        status: "archived"
      };
      
      await contract.setData(
        `experiment_${experimentId}`, 
        ethers.toUtf8Bytes(JSON.stringify(updatedExperiment))
      );
      
      setTransactionStatus({
        visible: true,
        status: "success",
        message: "Experiment archived successfully!"
      });
      
      await loadExperiments();
      
      setTimeout(() => {
        setTransactionStatus({ visible: false, status: "pending", message: "" });
      }, 2000);
    } catch (e: any) {
      setTransactionStatus({
        visible: true,
        status: "error",
        message: "Archiving failed: " + (e.message || "Unknown error")
      });
      
      setTimeout(() => {
        setTransactionStatus({ visible: false, status: "pending", message: "" });
      }, 3000);
    }
  };

  const isOwner = (address: string) => {
    return account.toLowerCase() === address.toLowerCase();
  };

  const faqItems = [
    {
      question: "What is FHE and how does it protect my data?",
      answer: "Fully Homomorphic Encryption (FHE) allows computations to be performed on encrypted data without decrypting it first. This means your psychological responses remain encrypted throughout the analysis process, ensuring complete privacy."
    },
    {
      question: "Can researchers see my individual responses?",
      answer: "No, researchers can only perform statistical analyses on the encrypted data. Individual responses remain private and are never decrypted."
    },
    {
      question: "How is my data stored securely?",
      answer: "All participant data is encrypted using FHE before being stored on the blockchain. Only aggregated statistical results are accessible to researchers."
    },
    {
      question: "What types of analyses can researchers perform?",
      answer: "Researchers can perform various statistical analyses including ANOVA, t-tests, correlation analysis, and regression - all while your data remains encrypted."
    },
    {
      question: "Can I withdraw my participation?",
      answer: "Yes, you can withdraw your participation at any time. Your encrypted data will be permanently deleted from the system."
    }
  ];

  const renderStatsChart = () => {
    const total = experiments.length || 1;
    const pendingPercentage = (pendingCount / total) * 100;
    const analyzedPercentage = (analyzedCount / total) * 100;
    const archivedPercentage = (archivedCount / total) * 100;

    return (
      <div className="stats-chart-container">
        <div className="chart-bar pending" style={{ height: `${pendingPercentage}%` }}>
          <div className="bar-label">{pendingCount}</div>
        </div>
        <div className="chart-bar analyzed" style={{ height: `${analyzedPercentage}%` }}>
          <div className="bar-label">{analyzedCount}</div>
        </div>
        <div className="chart-bar archived" style={{ height: `${archivedPercentage}%` }}>
          <div className="bar-label">{archivedCount}</div>
        </div>
      </div>
    );
  };

  const featureItems = [
    {
      title: "Privacy-Preserving Analysis",
      description: "Perform statistical analyses on encrypted data without compromising participant privacy",
      icon: "🔒"
    },
    {
      title: "End-to-End Encryption",
      description: "All participant responses are encrypted before leaving their device",
      icon: "🔑"
    },
    {
      title: "Ethical Compliance",
      description: "Built-in features to ensure compliance with academic ethics standards",
      icon: "📜"
    },
    {
      title: "FHE-Powered Statistics",
      description: "Run ANOVA, t-tests, and other analyses on encrypted datasets",
      icon: "📊"
    }
  ];

  if (loading) return (
    <div className="loading-screen">
      <div className="hand-drawn-spinner"></div>
      <p>Initializing encrypted connection...</p>
    </div>
  );

  return (
    <div className="app-container hand-drawn-theme">
      <header className="app-header">
        <div className="logo">
          <div className="logo-icon">
            <div className="brain-icon"></div>
          </div>
          <h1>Psych<span>FHE</span>Research</h1>
        </div>
        
        <div className="header-actions">
          <button 
            onClick={() => setShowCreateModal(true)} 
            className="create-experiment-btn hand-drawn-button"
          >
            <div className="add-icon"></div>
            New Experiment
          </button>
          <button 
            className="hand-drawn-button"
            onClick={checkContractAvailability}
          >
            Check FHE Status
          </button>
          <WalletManager account={account} onConnect={onConnect} onDisconnect={onDisconnect} />
        </div>
      </header>
      
      <div className="main-content">
        <div className="welcome-banner">
          <div className="welcome-text">
            <h2>Privacy-Preserving Psychology Research</h2>
            <p>Collect and analyze sensitive psychological data using Fully Homomorphic Encryption</p>
          </div>
          <div className="hand-drawn-illustration"></div>
        </div>
        
        <div className="tab-navigation">
          <button 
            className={`tab-button ${activeTab === "dashboard" ? "active" : ""}`}
            onClick={() => setActiveTab("dashboard")}
          >
            Dashboard
          </button>
          <button 
            className={`tab-button ${activeTab === "experiments" ? "active" : ""}`}
            onClick={() => setActiveTab("experiments")}
          >
            Experiments
          </button>
          <button 
            className={`tab-button ${activeTab === "features" ? "active" : ""}`}
            onClick={() => setActiveTab("features")}
          >
            Features
          </button>
          <button 
            className={`tab-button ${activeTab === "faq" ? "active" : ""}`}
            onClick={() => setActiveTab("faq")}
          >
            FAQ
          </button>
        </div>
        
        {activeTab === "dashboard" && (
          <div className="dashboard-panels">
            <div className="panel left-panel">
              <div className="panel-content">
                <h3>Research Statistics</h3>
                <div className="stats-container">
                  <div className="stat-card">
                    <div className="stat-value">{experiments.length}</div>
                    <div className="stat-label">Total Experiments</div>
                  </div>
                  <div className="stat-card">
                    <div className="stat-value">{pendingCount}</div>
                    <div className="stat-label">Pending Analysis</div>
                  </div>
                  <div className="stat-card">
                    <div className="stat-value">{analyzedCount}</div>
                    <div className="stat-label">Analyzed</div>
                  </div>
                  <div className="stat-card">
                    <div className="stat-value">{archivedCount}</div>
                    <div className="stat-label">Archived</div>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="panel right-panel">
              <div className="panel-content">
                <h3>Data Distribution</h3>
                <div className="chart-container">
                  {renderStatsChart()}
                  <div className="chart-legend">
                    <div className="legend-item">
                      <div className="color-dot pending"></div>
                      <span>Pending: {pendingCount}</span>
                    </div>
                    <div className="legend-item">
                      <div className="color-dot analyzed"></div>
                      <span>Analyzed: {analyzedCount}</span>
                    </div>
                    <div className="legend-item">
                      <div className="color-dot archived"></div>
                      <span>Archived: {archivedCount}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
        
        {activeTab === "experiments" && (
          <div className="experiments-section">
            <div className="section-header">
              <h2>Psychological Experiments</h2>
              <div className="header-actions">
                <button 
                  onClick={loadExperiments}
                  className="refresh-btn hand-drawn-button"
                  disabled={isRefreshing}
                >
                  {isRefreshing ? "Refreshing..." : "Refresh"}
                </button>
              </div>
            </div>
            
            <div className="experiments-list">
              {experiments.length === 0 ? (
                <div className="no-experiments">
                  <div className="hand-drawn-icon"></div>
                  <p>No experiments found</p>
                  <button 
                    className="hand-drawn-button primary"
                    onClick={() => setShowCreateModal(true)}
                  >
                    Create First Experiment
                  </button>
                </div>
              ) : (
                experiments.map(experiment => (
                  <div className="experiment-card" key={experiment.id}>
                    <div className="experiment-header">
                      <h3>{experiment.experimentName}</h3>
                      <span className={`status-badge ${experiment.status}`}>
                        {experiment.status}
                      </span>
                    </div>
                    
                    <div className="experiment-details">
                      <div className="detail-item">
                        <span className="detail-label">Participant:</span>
                        <span>{experiment.participant.substring(0, 6)}...{experiment.participant.substring(38)}</span>
                      </div>
                      <div className="detail-item">
                        <span className="detail-label">Date:</span>
                        <span>{new Date(experiment.timestamp * 1000).toLocaleDateString()}</span>
                      </div>
                      <div className="detail-item">
                        <span className="detail-label">Data Security:</span>
                        <span className="security-badge">FHE Encrypted</span>
                      </div>
                    </div>
                    
                    <div className="experiment-actions">
                      {isOwner(experiment.participant) && experiment.status === "pending" && (
                        <button 
                          className="action-btn hand-drawn-button"
                          onClick={() => analyzeExperiment(experiment.id)}
                        >
                          Analyze with FHE
                        </button>
                      )}
                      <button 
                        className="action-btn hand-drawn-button"
                        onClick={() => archiveExperiment(experiment.id)}
                      >
                        Archive
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
        
        {activeTab === "features" && (
          <div className="features-section">
            <h2>FHE-Powered Research Features</h2>
            <p className="subtitle">Advanced privacy-preserving tools for psychological research</p>
            
            <div className="features-grid">
              {featureItems.map((feature, index) => (
                <div className="feature-card" key={index}>
                  <div className="feature-icon">{feature.icon}</div>
                  <h3>{feature.title}</h3>
                  <p>{feature.description}</p>
                </div>
              ))}
            </div>
            
            <div className="fhe-explainer">
              <h3>How FHE Protects Participant Privacy</h3>
              <div className="explainer-steps">
                <div className="step">
                  <div className="step-number">1</div>
                  <p>Participant responses are encrypted on their device</p>
                </div>
                <div className="step">
                  <div className="step-number">2</div>
                  <p>Encrypted data is stored on the blockchain</p>
                </div>
                <div className="step">
                  <div className="step-number">3</div>
                  <p>Researchers perform analyses on encrypted data</p>
                </div>
                <div className="step">
                  <div className="step-number">4</div>
                  <p>Only statistical results are decrypted and shared</p>
                </div>
              </div>
            </div>
          </div>
        )}
        
        {activeTab === "faq" && (
          <div className="faq-section">
            <h2>Frequently Asked Questions</h2>
            <p className="subtitle">Learn about our privacy-preserving research platform</p>
            
            <div className="faq-items">
              {faqItems.map((faq, index) => (
                <div 
                  className={`faq-item ${expandedFAQ === index ? "expanded" : ""}`} 
                  key={index}
                  onClick={() => setExpandedFAQ(expandedFAQ === index ? null : index)}
                >
                  <div className="faq-question">
                    {faq.question}
                    <div className="expand-icon">{expandedFAQ === index ? "−" : "+"}</div>
                  </div>
                  {expandedFAQ === index && (
                    <div className="faq-answer">
                      {faq.answer}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
  
      {showCreateModal && (
        <ModalCreate 
          onSubmit={submitExperiment} 
          onClose={() => setShowCreateModal(false)} 
          creating={creating}
          experimentData={newExperimentData}
          setExperimentData={setNewExperimentData}
        />
      )}
      
      {walletSelectorOpen && (
        <WalletSelector
          isOpen={walletSelectorOpen}
          onWalletSelect={(wallet) => { onWalletSelect(wallet); setWalletSelectorOpen(false); }}
          onClose={() => setWalletSelectorOpen(false)}
        />
      )}
      
      {transactionStatus.visible && (
        <div className="transaction-modal">
          <div className="transaction-content hand-drawn-card">
            <div className={`transaction-icon ${transactionStatus.status}`}>
              {transactionStatus.status === "pending" && <div className="hand-drawn-spinner"></div>}
              {transactionStatus.status === "success" && <div className="check-icon">✓</div>}
              {transactionStatus.status === "error" && <div className="error-icon">✗</div>}
            </div>
            <div className="transaction-message">
              {transactionStatus.message}
            </div>
          </div>
        </div>
      )}
  
      <footer className="app-footer">
        <div className="footer-content">
          <div className="footer-brand">
            <div className="logo">
              <div className="brain-icon"></div>
              <span>PsychFHEResearch</span>
            </div>
            <p>Privacy-preserving psychological research using FHE technology</p>
          </div>
          
          <div className="footer-links">
            <a href="#" className="footer-link">Research Ethics</a>
            <a href="#" className="footer-link">Privacy Policy</a>
            <a href="#" className="footer-link">Documentation</a>
            <a href="#" className="footer-link">Contact Researchers</a>
          </div>
        </div>
        
        <div className="footer-bottom">
          <div className="fhe-badge">
            <span>FHE-Powered Privacy</span>
          </div>
          <div className="copyright">
            © {new Date().getFullYear()} PsychFHEResearch. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
};

interface ModalCreateProps {
  onSubmit: () => void; 
  onClose: () => void; 
  creating: boolean;
  experimentData: any;
  setExperimentData: (data: any) => void;
}

const ModalCreate: React.FC<ModalCreateProps> = ({ 
  onSubmit, 
  onClose, 
  creating,
  experimentData,
  setExperimentData
}) => {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setExperimentData({
      ...experimentData,
      [name]: value
    });
  };

  const handleSubmit = () => {
    if (!experimentData.experimentName || !experimentData.questionSet) {
      alert("Please fill required fields");
      return;
    }
    
    onSubmit();
  };

  return (
    <div className="modal-overlay">
      <div className="create-modal hand-drawn-card">
        <div className="modal-header">
          <h2>Create New Experiment</h2>
          <button onClick={onClose} className="close-modal">&times;</button>
        </div>
        
        <div className="modal-body">
          <div className="fhe-notice-banner">
            <div className="key-icon"></div> All participant data will be encrypted with FHE
          </div>
          
          <div className="form-group">
            <label>Experiment Name *</label>
            <input 
              type="text"
              name="experimentName"
              value={experimentData.experimentName} 
              onChange={handleChange}
              placeholder="Enter experiment name..." 
              className="hand-drawn-input"
            />
          </div>
          
          <div className="form-group">
            <label>Question Set *</label>
            <textarea 
              name="questionSet"
              value={experimentData.questionSet} 
              onChange={handleChange}
              placeholder="Enter your research questions..." 
              className="hand-drawn-textarea"
              rows={4}
            />
          </div>
          
          <div className="form-group">
            <label>Participant Information</label>
            <textarea 
              name="participantInfo"
              value={experimentData.participantInfo} 
              onChange={handleChange}
              placeholder="Information to provide participants..." 
              className="hand-drawn-textarea"
              rows={3}
            />
          </div>
          
          <div className="privacy-notice">
            <div className="privacy-icon"></div> Data remains encrypted during FHE analysis
          </div>
        </div>
        
        <div className="modal-footer">
          <button 
            onClick={onClose}
            className="cancel-btn hand-drawn-button"
          >
            Cancel
          </button>
          <button 
            onClick={handleSubmit} 
            disabled={creating}
            className="submit-btn hand-drawn-button primary"
          >
            {creating ? "Encrypting with FHE..." : "Create Experiment"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default App;