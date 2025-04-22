// LangGraph Workflow for Vulnerability Post Generation
import { END, StateGraph } from "@langchain/langgraph";
import { RunnableSequence } from "@langchain/core/runnables";
import { ChatPromptTemplate, PromptTemplate } from "@langchain/core/prompts";
import { StringOutputParser } from "@langchain/core/output_parsers";
import { StructuredOutputParser } from "langchain/output_parsers";
import LlmClient from "../llm/client.js";
import config from "../config/index.js";
import ErrorHandler from "../utils/error-handler.js";

/**
 * LangGraph workflow for vulnerability post generation
 */
class VulnPostWorkflow {
  constructor() {
    this.llmClient = new LlmClient();
    this.graph = null;
  }

  /**
   * Initialize the workflow graph
   */
  initialize() {
    try {
      // Define states and workflow
      this.buildGraph();
      console.log("Vulnerability post workflow initialized");
      return true;
    } catch (error) {
      ErrorHandler.handleError(error, "VulnPostWorkflow.initialize");
      return false;
    }
  }

  /**
   * Build the workflow graph with states and edges
   */
  buildGraph() {
    // Create a state graph
    const workflow = new StateGraph({
      channels: {
        vulnerability_data: {
          value: null,
        },
        initial_analysis: {
          value: null,
        },
        technical_details: {
          value: null,
        },
        mitigation_options: {
          value: null,
        },
        complete_post: {
          value: null,
        },
        error: {
          value: null,
        },
      },
    });

    // Add nodes for each stage of the process
    workflow.addNode("analyze_vulnerability", this.createAnalysisNode());
    workflow.addNode("generate_technical_details", this.createTechnicalDetailsNode());
    workflow.addNode("generate_mitigations", this.createMitigationsNode());
    workflow.addNode("compile_final_post", this.createFinalPostNode());

    // Define workflow edges
    workflow.addEdge("analyze_vulnerability", "generate_technical_details");
    workflow.addEdge("generate_technical_details", "generate_mitigations");
    workflow.addEdge("generate_mitigations", "compile_final_post");
    workflow.addEdge("compile_final_post", END);

    // Define workflow edges - Keep it simple for now by removing conditional error handling
    // We'll rely on the try/catch in the execute method instead

    // Compile the graph
    this.graph = workflow.compile();
  }

  /**
   * Create a node for initial vulnerability analysis
   */
  createAnalysisNode() {
    const analysisPromptTemplate = `
      You are a security expert analyzing a vulnerability.
      Please provide an initial assessment of this vulnerability:
      
      CVE ID: {cve_id}
      Vulnerability data: {vulnerability_data}
      
      Your analysis should include:
      1. Severity assessment
      2. Affected systems
      3. Initial impact assessment
      4. Exploitation difficulty
      
      Provide your analysis in a structured format.
    `;

    const analysisPrompt = ChatPromptTemplate.fromTemplate(analysisPromptTemplate);
    
    // Create the runnable sequence
    return RunnableSequence.from([
      async (state) => {
        try {
          const formattedPrompt = await analysisPrompt.format({
            cve_id: state.vulnerability_data.value.CVE_ID || "Unknown CVE",
            vulnerability_data: JSON.stringify(state.vulnerability_data.value, null, 2)
          });
          
          // Call LLM directly to avoid LangChain integration issues
          const response = await this.llmClient.generateSummary({
            CVE_ID: state.vulnerability_data.value.CVE_ID,
            DESCRIPTION: "Analyzing vulnerability for summary."
          });
          
          return {
            initial_analysis: response,
            vulnerability_data: state.vulnerability_data.value
          };
        } catch (error) {
          console.error("Error in analysis node:", error);
          return {
            initial_analysis: "Error analyzing vulnerability: " + error.message,
            vulnerability_data: state.vulnerability_data.value
          };
        }
      }
    ]);
  }

  /**
   * Create a node for generating technical details
   */
  createTechnicalDetailsNode() {
    const technicalPromptTemplate = `
      Based on the initial analysis and vulnerability data, generate detailed technical information about this vulnerability.
      
      Initial Analysis: {initial_analysis}
      CVE ID: {cve_id}
      Vulnerability Data: {vulnerability_data}
      
      Your technical analysis should include:
      1. Root cause explanation
      2. Attack vectors
      3. Vulnerable components
      4. Exploitation conditions
      5. Code or architectural weaknesses
      
      Be specific and technical in your explanation.
    `;

    const technicalPrompt = ChatPromptTemplate.fromTemplate(technicalPromptTemplate);
    
    // Create the runnable sequence
    return RunnableSequence.from([
      async (state) => {
        try {
          // Use LLM client's summary generation as a simplification
          const prompt = `Technical analysis for ${state.vulnerability_data.value.CVE_ID || "Unknown CVE"}: 
            ${state.initial_analysis.value}`;
          
          const response = await this.llmClient.generateSummary({
            CVE_ID: state.vulnerability_data.value.CVE_ID,
            DESCRIPTION: prompt
          });
          
          return {
            technical_details: response,
            initial_analysis: state.initial_analysis.value,
            vulnerability_data: state.vulnerability_data.value
          };
        } catch (error) {
          console.error("Error in technical details node:", error);
          return {
            technical_details: "Error generating technical details: " + error.message,
            initial_analysis: state.initial_analysis.value,
            vulnerability_data: state.vulnerability_data.value
          };
        }
      }
    ]);
  }

  /**
   * Create a node for generating mitigations
   */
  createMitigationsNode() {
    const mitigationPromptTemplate = `
      Based on the technical analysis of this vulnerability, provide comprehensive mitigation recommendations.
      
      Technical Details: {technical_details}
      CVE ID: {cve_id}
      
      Your mitigation guidance should include:
      1. Patching recommendations
      2. Configuration changes
      3. Temporary workarounds
      4. Detection mechanisms
      5. Long-term architectural improvements
      
      Prioritize the mitigations and explain why each is effective.
    `;

    const mitigationPrompt = ChatPromptTemplate.fromTemplate(mitigationPromptTemplate);
    
    // Create the runnable sequence
    return RunnableSequence.from([
      async (state) => {
        try {
          // Use LLM client's summary generation as a simplification
          const prompt = `Mitigation recommendations for ${state.vulnerability_data.value.CVE_ID || "Unknown CVE"}: 
            ${state.technical_details.value}`;
          
          const response = await this.llmClient.generateSummary({
            CVE_ID: state.vulnerability_data.value.CVE_ID,
            DESCRIPTION: prompt
          });
          
          return {
            mitigation_options: response,
            technical_details: state.technical_details.value,
            initial_analysis: state.initial_analysis.value,
            vulnerability_data: state.vulnerability_data.value
          };
        } catch (error) {
          console.error("Error in mitigations node:", error);
          return {
            mitigation_options: "Error generating mitigations: " + error.message,
            technical_details: state.technical_details.value,
            initial_analysis: state.initial_analysis.value,
            vulnerability_data: state.vulnerability_data.value
          };
        }
      }
    ]);
  }

  /**
   * Create a node for compiling the final blog post
   */
  createFinalPostNode() {
    const finalPromptTemplate = `
      Compile a comprehensive vulnerability blog post based on all the information gathered.
      
      CVE ID: {cve_id}
      Initial Analysis: {initial_analysis}
      Technical Details: {technical_details}
      Mitigation Options: {mitigation_options}
      
      Create a well-structured blog post with the following sections:
      1. Executive Summary
      2. Vulnerability Snapshot (as a table)
      3. Technical Deep Dive
      4. Impact Assessment
      5. Mitigation and Remediation
      6. Conclusion
      
      Format the post in Markdown and ensure it is comprehensive, accurate, and valuable for security professionals.
    `;

    const finalPrompt = ChatPromptTemplate.fromTemplate(finalPromptTemplate);
    
    // Create the runnable sequence
    return RunnableSequence.from([
      async (state) => {
        try {
          // Use the LLM client's full blog post generation instead
          const blogPost = await this.llmClient.generateBlogPost({
            CVE_ID: state.vulnerability_data.value.CVE_ID,
            DESCRIPTION: `This post combines: ${state.initial_analysis.value} ${state.technical_details.value} ${state.mitigation_options.value}`,
            SUMMARY: state.vulnerability_data.value.SUMMARY || state.initial_analysis.value.substring(0, 100),
            TECHNICAL_DETAILS: state.technical_details.value,
            WORKAROUNDS: state.mitigation_options.value,
            CVSS_SCORE: state.vulnerability_data.value.CVSS_SCORE,
            CVSS_VECTOR: state.vulnerability_data.value.CVSS_VECTOR,
            AFFECTED_PRODUCTS: state.vulnerability_data.value.AFFECTED_PRODUCTS,
            REFERENCES: state.vulnerability_data.value.REFERENCES
          });
          
          return {
            complete_post: blogPost
          };
        } catch (error) {
          console.error("Error in final post node:", error);
          return {
            complete_post: "Error generating final post: " + error.message
          };
        }
      }
    ]);
  }

  /**
   * Execute the workflow with vulnerability data
   * @param {Object} vulnerabilityData - Data about the vulnerability
   * @returns {Promise<Object>} - Workflow results
   */
  async execute(vulnerabilityData) {
    try {
      console.log(`Starting vulnerability post workflow for ${vulnerabilityData.CVE_ID || 'unknown CVE'}`);
      
      // Ensure graph is initialized
      if (!this.graph) {
        this.initialize();
      }
      
      // Execute the workflow
      const result = await this.graph.invoke({
        vulnerability_data: {
          value: vulnerabilityData
        }
      });
      
      return {
        success: true,
        post: result.complete_post.value,
        analysis: result.initial_analysis?.value,
        technicalDetails: result.technical_details?.value,
        mitigations: result.mitigation_options?.value
      };
    } catch (error) {
      ErrorHandler.handleError(error, "VulnPostWorkflow.execute");
      return {
        success: false,
        error: error.message
      };
    }
  }
}

export default VulnPostWorkflow;