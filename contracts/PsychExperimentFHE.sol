// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { FHE, euint32, ebool } from "@fhevm/solidity/lib/FHE.sol";
import { SepoliaConfig } from "@fhevm/solidity/config/ZamaConfig.sol";

contract PsychExperimentFHE is SepoliaConfig {
    struct EncryptedResponse {
        uint256 id;
        euint32 encryptedAnswer;
        euint32 encryptedQuestionId;
        uint256 timestamp;
    }

    struct DecryptedResponse {
        string answer;
        string questionId;
        bool isRevealed;
    }

    uint256 public responseCount;
    mapping(uint256 => EncryptedResponse) public encryptedResponses;
    mapping(uint256 => DecryptedResponse) public decryptedResponses;

    mapping(string => euint32) private encryptedQuestionCounts;
    string[] private questionList;

    mapping(uint256 => uint256) private requestToResponseId;

    event ResponseSubmitted(uint256 indexed id, uint256 timestamp);
    event DecryptionRequested(uint256 indexed id);
    event ResponseDecrypted(uint256 indexed id);

    modifier onlyParticipant(uint256 responseId) {
        _;
    }

    function submitEncryptedResponse(
        euint32 encryptedAnswer,
        euint32 encryptedQuestionId
    ) public {
        responseCount += 1;
        uint256 newId = responseCount;

        encryptedResponses[newId] = EncryptedResponse({
            id: newId,
            encryptedAnswer: encryptedAnswer,
            encryptedQuestionId: encryptedQuestionId,
            timestamp: block.timestamp
        });

        decryptedResponses[newId] = DecryptedResponse({
            answer: "",
            questionId: "",
            isRevealed: false
        });

        emit ResponseSubmitted(newId, block.timestamp);
    }

    function requestResponseDecryption(uint256 responseId) public onlyParticipant(responseId) {
        EncryptedResponse storage resp = encryptedResponses[responseId];
        require(!decryptedResponses[responseId].isRevealed, "Already decrypted");

        bytes32[] memory ciphertexts = new bytes32[](2);
        ciphertexts[0] = FHE.toBytes32(resp.encryptedAnswer);
        ciphertexts[1] = FHE.toBytes32(resp.encryptedQuestionId);

        uint256 reqId = FHE.requestDecryption(ciphertexts, this.decryptResponse.selector);
        requestToResponseId[reqId] = responseId;

        emit DecryptionRequested(responseId);
    }

    function decryptResponse(
        uint256 requestId,
        bytes memory cleartexts,
        bytes memory proof
    ) public {
        uint256 responseId = requestToResponseId[requestId];
        require(responseId != 0, "Invalid request");

        EncryptedResponse storage eResp = encryptedResponses[responseId];
        DecryptedResponse storage dResp = decryptedResponses[responseId];
        require(!dResp.isRevealed, "Already decrypted");

        FHE.checkSignatures(requestId, cleartexts, proof);

        string[] memory results = abi.decode(cleartexts, (string[]));

        dResp.answer = results[0];
        dResp.questionId = results[1];
        dResp.isRevealed = true;

        if (!FHE.isInitialized(encryptedQuestionCounts[dResp.questionId])) {
            encryptedQuestionCounts[dResp.questionId] = FHE.asEuint32(0);
            questionList.push(dResp.questionId);
        }
        encryptedQuestionCounts[dResp.questionId] = FHE.add(
            encryptedQuestionCounts[dResp.questionId],
            FHE.asEuint32(1)
        );

        emit ResponseDecrypted(responseId);
    }

    function getDecryptedResponse(uint256 responseId) public view returns (
        string memory answer,
        string memory questionId,
        bool isRevealed
    ) {
        DecryptedResponse storage r = decryptedResponses[responseId];
        return (r.answer, r.questionId, r.isRevealed);
    }

    function getEncryptedQuestionCount(string memory questionId) public view returns (euint32) {
        return encryptedQuestionCounts[questionId];
    }

    function requestQuestionCountDecryption(string memory questionId) public {
        euint32 count = encryptedQuestionCounts[questionId];
        require(FHE.isInitialized(count), "Question not found");

        bytes32[] memory ciphertexts = new bytes32[](1);
        ciphertexts[0] = FHE.toBytes32(count);

        uint256 reqId = FHE.requestDecryption(ciphertexts, this.decryptQuestionCount.selector);
        requestToResponseId[reqId] = bytes32ToUint(keccak256(abi.encodePacked(questionId)));
    }

    function decryptQuestionCount(
        uint256 requestId,
        bytes memory cleartexts,
        bytes memory proof
    ) public {
        uint256 questionHash = requestToResponseId[requestId];
        string memory questionId = getQuestionFromHash(questionHash);

        FHE.checkSignatures(requestId, cleartexts, proof);

        uint32 count = abi.decode(cleartexts, (uint32));
    }

    function bytes32ToUint(bytes32 b) private pure returns (uint256) {
        return uint256(b);
    }

    function getQuestionFromHash(uint256 hash) private view returns (string memory) {
        for (uint i = 0; i < questionList.length; i++) {
            if (bytes32ToUint(keccak256(abi.encodePacked(questionList[i]))) == hash) {
                return questionList[i];
            }
        }
        revert("Question not found");
    }
}