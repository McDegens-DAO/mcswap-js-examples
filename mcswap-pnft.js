import * as solanaWeb3 from "@solana/web3.js";
import * as splToken from "@solana/spl-token";
// import * as mplAuthRules from "@metaplex-foundation/mpl-token-auth-rules"
import * as mplToken from "@metaplex-foundation/mpl-token-metadata";
import $ from 'jquery';
import BN from "bn.js";
import * as bs58 from "bs58";
import * as buffer from "buffer";
window.Buffer = buffer.Buffer;
import * as BufferLayout from 'buffer-layout';

// const authority = (property = "authority") => {
//     return BufferLayout.blob(36, property);
// };  
// const isNative = (property = "isNative") => {
//     return BufferLayout.blob(12, property);
// };
// const ruleSetRevision = (property = "ruleSetRevision") => {
//     return BufferLayout.blob(9, property);
// };
// const delegate = (property = "delegate") => {
//     return BufferLayout.blob(33, property);
// };  
// const delegateRole = (property = "delegateRole") => {
//     return BufferLayout.blob(2, property);
// };  
const publicKey = (property = "publicKey") => {
    return BufferLayout.blob(32, property);
};  
const uint64 = (property = "uint64") => {
    return BufferLayout.blob(8, property);
};

// const ATA_STATE = BufferLayout.struct([
//     publicKey("mint"),
//     publicKey("owner"),
//     uint64("amount"),
//     authority("delegate"),
//     BufferLayout.u8("is_frozen"),
//     isNative("is_native"),
//     uint64("delegated_amount"),
//     authority("close_authority"),
// ]);

// const TOKEN_RECORD_STATE = BufferLayout.struct([
//     BufferLayout.u8("key"),
//     BufferLayout.u8("bump"),
//     BufferLayout.u8("token_state"),
//     ruleSetRevision("ruleset_revision"),
//     delegate("delegate"),
//     delegateRole("delegate_role"),
// ]);

const PROGRAM_STATE = BufferLayout.struct([
    BufferLayout.u8("is_initialized"),
    uint64("fee_lamports"),
    BufferLayout.u8("dev_percentage"),
    publicKey("dev_treasury"),
    publicKey("mcdegens_treasury"),
]);

const SWAP_STATE = BufferLayout.struct([
    BufferLayout.u8("is_initialized"),
    uint64("utime"),
    BufferLayout.u8("is_swap"),
    publicKey("initializer"),
    publicKey("initializer_mint"),
    publicKey("taker"),
    publicKey("swap_mint"),
    uint64("swap_lamports"),
    publicKey("swap_token_mint"),
    uint64("swap_tokens"),
]);

let wallet_initialized = false;
let provider = null;
let connection = null;

async function connectButton(which) {
    const getProviderPhantom = async () => {
        if ("solana" in window) {
            const provider = window.solana;
            if (provider.isPhantom) {
                console.log("Is Phantom installed?  ", provider.isPhantom);
                return provider;
            }
        } else {
            window.open("https://www.phantom.app/", "_blank");
        }
    };

    const getProviderSolflare = async () => {
        if ("solflare" in window) {
            const provider = window.solflare;
            return provider;
        }
    }

    if (!wallet_initialized) {
        console.log("initializing " + which);
        if (which == 'phantom') {
            provider = await getProviderPhantom();
        } else if (which == 'solflare') {
            provider = await getProviderSolflare();
        }
        provider.connect();

        provider.on("connect", async () => {
            wallet_initialized = true;
        })

        $('#connectButtonSolflare').prop('disabled', true);
        $('#connectButtonPhantom').prop('disabled', true);
        $('#thingButton').prop('disabled', false);
    } else {
        console.log('already initialized wallet');
    }
}

$('#connectButtonPhantom').on('click', () => {
    console.log("connect");
    connectButton('phantom');
});

$('#connectButtonSolflare').on('click', () => {
    console.log("connect");
    connectButton('solflare');
});

async function connectRPC() {
    connection = new solanaWeb3.Connection(
    "https://rpc.helius.xyz/?api-key=YOUR_KEY_HERE",
        'confirmed',
    );
    console.log("Connected to rpc");
}

async function InitializeSwap() {
    if (!wallet_initialized) {
        console.log("Error, wallet not initialized");
        return
    }
    console.log("Connected to wallet");
    console.log("Provider Pubkey: ", provider.publicKey.toString());

    // These are passed
    let mint = "FB4CD2X7cWosyHgtUxDYWrJ7FdTuZST4SLBpi2abevN9";
    let takerMint = "HAe5tW4P91bRK13Qi873DGCdeh37Sm9Z362n4ibPWg8r";
    let taker = "2qhQBTHTP1h81GDMj8WmkTuYVMkyxWgYWk2mcytrpnEW";
    // let takerMint = "11111111111111111111111111111111";  // Use if not swapping
    console.log("mint ", mint);
    console.log("takerMint ", takerMint);
    console.log("taker ", taker);
    let swapLamports = 1000;
    //  let swapTokenMint = new solanaWeb3.PublicKey("11111111111111111111111111111111");  // Use if no token
    let swapTokenMint = new solanaWeb3.PublicKey("AVm6WLmMuzdedAMjpXLYmSGjLLPPjjVWNuR6JJhJLWn3");
    let swapTokens = 1000000000;

    let isSwap = true;
    if (takerMint == "11111111111111111111111111111111") {
        isSwap = false
    }

    let pNFTSwapProgramId = new solanaWeb3.PublicKey("2bY36scRMEUJHJToVGjJ2uY8PdSrRPr73siNwGbv1ZNT");
    let splATAProgramId = new solanaWeb3.PublicKey("ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL");
    let mplAuthRulesProgramId = new solanaWeb3.PublicKey("auth9SigNpDKz4sJJ1DfCTuZrZNSAgh9sFD3rboVmgg");
    let mplAuthRulesAccount = new solanaWeb3.PublicKey("eBJLFYPxJmMGKuFwpDWkzxZeUrad92kZRC5BJLpzyT9");

    let programStatePDA = solanaWeb3.PublicKey.findProgramAddressSync(
        [Buffer.from("program-state")],
        pNFTSwapProgramId
    );
    console.log("Program State PDA: ", programStatePDA[0].toString());
    let programState = null;
    await connection.getAccountInfo(
        programStatePDA[0]
    )
    .then(
        function(response) {
            programState = response;
        }
    )
    .catch(
        function(error) {
            error = JSON.stringify(error);
            error = JSON.parse(error);
            console.log("Error: ", error);
            return;
        }
    );

    let feeLamports = null;
    let devTreasury = null;
    let mcDegensTreasury = null;
    if (programState != null) {
        const encodedProgramStateData = programState.data;
        const decodedProgramStateData = PROGRAM_STATE.decode(
            encodedProgramStateData
        );
        console.log("programState - is_initialized: ", decodedProgramStateData.is_initialized);
        console.log("programState - fee_lamports: ", new BN(decodedProgramStateData.fee_lamports, 10, "le").toString());
        console.log("programState - dev_percentage: ", new BN(decodedProgramStateData.dev_percentage, 10, "le").toString());
        console.log("programState - dev_treasury: ", new solanaWeb3.PublicKey(decodedProgramStateData.dev_treasury).toString());
        console.log("programState - mcdegens_treasury: ", new solanaWeb3.PublicKey(decodedProgramStateData.mcdegens_treasury).toString());

        feeLamports = new BN(decodedProgramStateData.fee_lamports, 10, "le");
        devTreasury = new solanaWeb3.PublicKey(decodedProgramStateData.dev_treasury);
        mcDegensTreasury = new solanaWeb3.PublicKey(decodedProgramStateData.mcdegens_treasury);
    } else {
        console.log("Program State Not Initialized");    
        return;
    }

    let swapVaultPDA = solanaWeb3.PublicKey.findProgramAddressSync(
        [Buffer.from("swap-vault")],
        pNFTSwapProgramId
    );
    console.log("Swap Vault PDA: ", swapVaultPDA[0].toString());

    let swapStatePDA = solanaWeb3.PublicKey.findProgramAddressSync(
        [Buffer.from("swap-state"), new solanaWeb3.PublicKey(mint).toBytes(), new solanaWeb3.PublicKey(takerMint).toBytes()],
        pNFTSwapProgramId
    );
    console.log("Swap State PDA: ", swapStatePDA[0].toString());

    let providerMintATA = await splToken.getAssociatedTokenAddress(
        new solanaWeb3.PublicKey(mint),
        provider.publicKey,
        false,
        splToken.TOKEN_PROGRAM_ID,
        splToken.ASSOCIATED_TOKEN_PROGRAM_ID,
    );
    console.log("providerMintATA ", providerMintATA.toString());

    let tokenMetadataPDA = solanaWeb3.PublicKey.findProgramAddressSync(
        [Buffer.from("metadata"), mplToken.PROGRAM_ID.toBytes(), new solanaWeb3.PublicKey(mint).toBytes()],
        mplToken.PROGRAM_ID
    );
    console.log("Token Metadata PDA: ", tokenMetadataPDA[0].toString());

    let tokenMasterEditionPDA = solanaWeb3.PublicKey.findProgramAddressSync(
        [Buffer.from("metadata"), mplToken.PROGRAM_ID.toBytes(), new solanaWeb3.PublicKey(mint).toBytes(), Buffer.from("edition")],
        mplToken.PROGRAM_ID
    );
    console.log("Token Master Edition PDA: ", tokenMasterEditionPDA[0].toString());

    let tokenDestinationATA = await splToken.getAssociatedTokenAddress(
        new solanaWeb3.PublicKey(mint),
        swapVaultPDA[0],
        true,
        splToken.TOKEN_PROGRAM_ID,
        splToken.ASSOCIATED_TOKEN_PROGRAM_ID,
    );
    console.log("tokenDestinationATA ", tokenDestinationATA);

    let tokenRecordPDA = solanaWeb3.PublicKey.findProgramAddressSync(
        [Buffer.from("metadata"), 
        mplToken.PROGRAM_ID.toBytes(),
        new solanaWeb3.PublicKey(mint).toBytes(), 
        Buffer.from("token_record"),
        new solanaWeb3.PublicKey(providerMintATA).toBytes()],
        mplToken.PROGRAM_ID,
    );
    console.log("Token Record PDA ", tokenRecordPDA[0].toString());

    let tokenRecordDesinationPDA = solanaWeb3.PublicKey.findProgramAddressSync(
        [Buffer.from("metadata"), 
        mplToken.PROGRAM_ID.toBytes(),
        new solanaWeb3.PublicKey(mint).toBytes(), 
        Buffer.from("token_record"),
        new solanaWeb3.PublicKey(tokenDestinationATA).toBytes()],
        mplToken.PROGRAM_ID,
    );
    console.log("Token Record Destination PDA ", tokenRecordDesinationPDA[0].toString());
        
    let createTakerMintATA = false;
    let takerMintATA = null;
    let createTakerMintATAIx = null;
    if (takerMint != "11111111111111111111111111111111") {
        takerMintATA = await splToken.getAssociatedTokenAddress(
            new solanaWeb3.PublicKey(takerMint),
            provider.publicKey,
            false,
            splToken.TOKEN_PROGRAM_ID,
            splToken.ASSOCIATED_TOKEN_PROGRAM_ID,
        );
        console.log("Taker Mint ATA: ", takerMintATA.toString());
        
        await connection.getAccountInfo(
            takerMintATA
        )
        .then(
            function(response) {
                console.log("takerMintATA response ", response);
                if (response == null) {
                    createTakerMintATA = true;
                    createTakerMintATAIx = splToken.createAssociatedTokenAccountInstruction(
                        provider.publicKey,
                        takerMintATA,
                        provider.publicKey,
                        new solanaWeb3.PublicKey(takerMint),
                        splToken.TOKEN_PROGRAM_ID,
                        splToken.ASSOCIATED_TOKEN_PROGRAM_ID,
                    )
                    console.log("Create Taker Mint ATA Ix: ", createTakerMintATAIx); 
                } else {
                    createTakerMintATA = false;
                }
            }
        )
        .catch(
            function(error) {
                error = JSON.stringify(error);
                error = JSON.parse(error);
                console.log("Error: ", error);
                return;
            }
        );    
    }

    let createSwapTokenATA = null; 
    let createSwapTokenATAIx = null;
    let swapTokenATA = await splToken.getAssociatedTokenAddress(
        swapTokenMint,
        provider.publicKey,
        false,
        splToken.TOKEN_PROGRAM_ID,
        splToken.ASSOCIATED_TOKEN_PROGRAM_ID,
    );
    console.log("Swap Token ATA: ", swapTokenATA.toString());    

    await connection.getAccountInfo(
        swapTokenATA
    )
    .then(
        function(response) {
            console.log("swapMintATA response ", response);
            if (response == null) {
                createSwapTokenATA = true;
                createSwapTokenATAIx = splToken.createAssociatedTokenAccountInstruction(
                    provider.publicKey,
                    swapTokenATA,
                    provider.publicKey,
                    swapTokenMint,
                    splToken.TOKEN_PROGRAM_ID,
                    splToken.ASSOCIATED_TOKEN_PROGRAM_ID,
                )
                console.log("Create Swap Token ATA Ix: ", createSwapTokenATAIx); 
            } else {
                createSwapMintATA = false;
            }
        }
    )
    .catch(
        function(error) {
            error = JSON.stringify(error);
            error = JSON.parse(error);
            console.log("Error: ", error);
            return;
        }
    );
            
    var totalSize = 1 + 1 + 32 + 32 + 8 + 32 + 8;
    console.log("totalSize", totalSize);

    var uarray = new Uint8Array(totalSize);
    let counter = 0;    
    uarray[counter++] = 0; // 0 = nft_swap InitializeSwap instruction

    if (isSwap == true) {
        uarray[counter++] = 1;
    } else {
        uarray[counter++] = 0;
    }
    
    let takerb58 = bs58.decode(taker);
    var arr = Array.prototype.slice.call(Buffer.from(takerb58), 0);
    for (let i = 0; i < arr.length; i++) {
        uarray[counter++] = arr[i];
    }
        
    let takerMintb58 = bs58.decode(takerMint);
    var arr = Array.prototype.slice.call(Buffer.from(takerMintb58), 0);
    for (let i = 0; i < arr.length; i++) {
        uarray[counter++] = arr[i];
    }

    var byteArray = [0, 0, 0, 0, 0, 0, 0, 0];
    for ( var index = 0; index < byteArray.length; index ++ ) {
        var byte = swapLamports & 0xff;
        byteArray [ index ] = byte;
        swapLamports = (swapLamports - byte) / 256 ;
    }
    for (let i = 0; i < byteArray.length; i++) {
        uarray[counter++] = byteArray[i];
    }

    let swapTokenMintb58 = bs58.decode(swapTokenMint.toString());
    var arr = Array.prototype.slice.call(Buffer.from(swapTokenMintb58), 0);
    for (let i = 0; i < arr.length; i++) {
        uarray[counter++] = arr[i];
    }

    var byteArray = [0, 0, 0, 0, 0, 0, 0, 0];
    for ( var index = 0; index < byteArray.length; index ++ ) {
        var byte = swapTokens & 0xff;
        byteArray [ index ] = byte;
        swapTokens = (swapTokens - byte) / 256 ;
    }
    for (let i = 0; i < byteArray.length; i++) {
        uarray[counter++] = byteArray[i];
    }

    console.log("Contract Data: ", uarray);

    const initializeSwapIx = new solanaWeb3.TransactionInstruction({
        programId: pNFTSwapProgramId,
        data: Buffer.from(
            uarray
        ),
        keys: [
            { pubkey: provider.publicKey, isSigner: true, isWritable: true }, // 0
            { pubkey: programStatePDA[0], isSigner: false, isWritable: false }, // 1
            { pubkey: swapVaultPDA[0], isSigner: false, isWritable: true }, // 2
            { pubkey: swapStatePDA[0], isSigner: false, isWritable: true }, // 3
            { pubkey: providerMintATA, isSigner: false, isWritable: true }, // 4
            { pubkey: new solanaWeb3.PublicKey(mint), isSigner: false, isWritable: false }, // 5
            { pubkey: tokenMetadataPDA[0], isSigner: false, isWritable: true }, // 6
            { pubkey: tokenMasterEditionPDA[0], isSigner: false, isWritable: false }, // 7
            { pubkey: tokenDestinationATA, isSigner: false, isWritable: true }, // 8
            { pubkey: tokenRecordPDA[0], isSigner: false, isWritable: true }, // 9
            { pubkey: tokenRecordDesinationPDA[0], isSigner: false, isWritable: true }, // 10
            { pubkey: solanaWeb3.SystemProgram.programId, isSigner: false, isWritable: false }, // 11
            { pubkey: solanaWeb3.SYSVAR_INSTRUCTIONS_PUBKEY, isSigner: false, isWritable: false }, // 12
            { pubkey: splToken.TOKEN_PROGRAM_ID, isSigner: false, isWritable: false }, // 13
            { pubkey: splATAProgramId, isSigner: false, isWritable: false }, // 14
            { pubkey: mplToken.PROGRAM_ID, isSigner: false, isWritable: false }, // 15
            { pubkey: mplAuthRulesProgramId, isSigner: false, isWritable: false }, // 16
            { pubkey: mplAuthRulesAccount, isSigner: false, isWritable: false }, // 17
            { pubkey: devTreasury, isSigner: false, isWritable: true }, // 18
            { pubkey: mcDegensTreasury, isSigner: false, isWritable: true }, // 19
        ]
    });
    console.log("Initialize Swap Ix: ", initializeSwapIx);

    const computePriceIx = solanaWeb3.ComputeBudgetProgram.setComputeUnitPrice({
        microLamports: 1,
    });

    const computeLimitIx = solanaWeb3.ComputeBudgetProgram.setComputeUnitLimit({
        units: 300000,
    });

    let messageV0 = null;
    if (createTakerMintATA == true && createSwapTokenATA == true) {
        messageV0 = new solanaWeb3.TransactionMessage({
            payerKey: provider.publicKey,
            recentBlockhash: (await connection.getRecentBlockhash('confirmed')).blockhash,
            instructions: [
                computePriceIx,
                computeLimitIx,
                createTakerMintATAIx,
                createSwapTokenATAIx,
                initializeSwapIx
            ],
        }).compileToV0Message([]);
    } else if (createTakerMintATA == true) {
        messageV0 = new solanaWeb3.TransactionMessage({
            payerKey: provider.publicKey,
            recentBlockhash: (await connection.getRecentBlockhash('confirmed')).blockhash,
            instructions: [
                computePriceIx,
                computeLimitIx,
                createTakerMintATAIx,
                initializeSwapIx
            ],
        }).compileToV0Message([]);
    } else if ( createSwapTokenATA == true) {
        messageV0 = new solanaWeb3.TransactionMessage({
            payerKey: provider.publicKey,
            recentBlockhash: (await connection.getRecentBlockhash('confirmed')).blockhash,
            instructions: [
                computePriceIx,
                computeLimitIx,
                createSwapTokenATAIx,
                initializeSwapIx
            ],
        }).compileToV0Message([]);
    } else {
        messageV0 = new solanaWeb3.TransactionMessage({
            payerKey: provider.publicKey,
            recentBlockhash: (await connection.getRecentBlockhash('confirmed')).blockhash,
            instructions: [
                computePriceIx,
                computeLimitIx,
                initializeSwapIx
            ],
        }).compileToV0Message([]);
    }

    const initializeSwapTx = new solanaWeb3.VersionedTransaction(messageV0);
    try {
        let signedTx = await provider.signTransaction(initializeSwapTx);
        const txId = await connection.sendTransaction(signedTx);
        console.log("Signature: ", txId)
        console.log(`https://solscan.io/tx/${txId}?cluster=mainnet`);
    } catch(error) {
        console.log("Error: ", error)
        error = JSON.stringify(error);
        error = JSON.parse(error);
        console.log("Error Logs: ", error)
        return;
    }
}

async function SwapPNFTs() {
    if (!wallet_initialized) {
        console.log("Error, wallet not initialized");
        return
    }
    console.log("Connected to wallet");
    console.log("Provider Pubkey: ", provider.publicKey.toString());

    // These are passed
    let mint = "FB4CD2X7cWosyHgtUxDYWrJ7FdTuZST4SLBpi2abevN9";
    let takerMint = "HAe5tW4P91bRK13Qi873DGCdeh37Sm9Z362n4ibPWg8r";
    // let takerMint = "11111111111111111111111111111111";
    console.log("mint ", mint);
    console.log("takerMint ", takerMint);

    let pNFTSwapProgramId = new solanaWeb3.PublicKey("2bY36scRMEUJHJToVGjJ2uY8PdSrRPr73siNwGbv1ZNT");
    let splATAProgramId = new solanaWeb3.PublicKey("ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL");
    let mplAuthRulesProgramId = new solanaWeb3.PublicKey("auth9SigNpDKz4sJJ1DfCTuZrZNSAgh9sFD3rboVmgg");
    let mplAuthRulesAccount = new solanaWeb3.PublicKey("eBJLFYPxJmMGKuFwpDWkzxZeUrad92kZRC5BJLpzyT9");

    let programStatePDA = solanaWeb3.PublicKey.findProgramAddressSync(
        [Buffer.from("program-state")],
        pNFTSwapProgramId
    );
    console.log("Program State PDA: ", programStatePDA[0].toString());
    let programState = null;
    await connection.getAccountInfo(
        programStatePDA[0]
    )
    .then(
        function(response) {
            programState = response;
        }
    )
    .catch(
        function(error) {
            error = JSON.stringify(error);
            error = JSON.parse(error);
            console.log("Error: ", error);
            return;
        }
    );

    let feeLamports = null;
    let devTreasury = null;
    let mcDegensTreasury = null;
    if (programState != null) {
        const encodedProgramStateData = programState.data;
        const decodedProgramStateData = PROGRAM_STATE.decode(
            encodedProgramStateData
        );
        console.log("programState - is_initialized: ", decodedProgramStateData.is_initialized);
        console.log("programState - fee_lamports: ", new BN(decodedProgramStateData.fee_lamports, 10, "le").toString());
        console.log("programState - dev_percentage: ", new BN(decodedProgramStateData.dev_percentage, 10, "le").toString());
        console.log("programState - dev_treasury: ", new solanaWeb3.PublicKey(decodedProgramStateData.dev_treasury).toString());
        console.log("programState - mcdegens_treasury: ", new solanaWeb3.PublicKey(decodedProgramStateData.mcdegens_treasury).toString());

        feeLamports = new BN(decodedProgramStateData.fee_lamports, 10, "le");
        devTreasury = new solanaWeb3.PublicKey(decodedProgramStateData.dev_treasury);
        mcDegensTreasury = new solanaWeb3.PublicKey(decodedProgramStateData.mcdegens_treasury);
    } else {
        console.log("Program State Not Initialized");    
        return;
    }
    
    let swapVaultPDA = solanaWeb3.PublicKey.findProgramAddressSync(
        [Buffer.from("swap-vault")],
        pNFTSwapProgramId
    );
    console.log("Swap Vault PDA: ", swapVaultPDA[0].toString());

    let swapStatePDA = solanaWeb3.PublicKey.findProgramAddressSync(
        [Buffer.from("swap-state"), new solanaWeb3.PublicKey(mint).toBytes(), new solanaWeb3.PublicKey(takerMint).toBytes()],
        pNFTSwapProgramId
    );
    console.log("Swap State PDA: ", swapStatePDA[0].toString());

    let swapState = null;
    await connection.getAccountInfo(
        swapStatePDA[0]
    )
    .then(
        function(response) {
            swapState = response;
        }
    )
    .catch(
        function(error) {
            error = JSON.stringify(error);
            error = JSON.parse(error);
            console.log("Error: ", error);
            return;
        }
    );

    let initializer = null;
    let initializerTokenMint = null
    let takerTokenMint = null;
    let swapTokenMint = null;
    if (swapState != null) {
        const encodedSwapStateData = swapState.data;
        const decodedSwapStateData = SWAP_STATE.decode(
            encodedSwapStateData
        );
        console.log("swapState - is_initialized: ", decodedSwapStateData.is_initialized);
        console.log("swapState - utime", new BN(decodedSwapStateData.utime, 10, "le").toString());
        console.log("swapState - initializer: ", new solanaWeb3.PublicKey(decodedSwapStateData.initializer).toString());
        console.log("swapState - initializer_mint: ", new solanaWeb3.PublicKey(decodedSwapStateData.initializer_mint).toString());
        console.log("swapState - swap_mint: ", new solanaWeb3.PublicKey(decodedSwapStateData.swap_mint).toString());
        console.log("swapState - swap_lamports", new BN(decodedSwapStateData.swap_lamports, 10, "le").toString());
        console.log("swapState - swap_token_mint", new solanaWeb3.PublicKey(decodedSwapStateData.swap_token_mint).toString());
        console.log("swapState - swap_tokens", new BN(decodedSwapStateData.swap_tokens, 10, "le").toString());

        initializer = new solanaWeb3.PublicKey(decodedSwapStateData.initializer);
        initializerTokenMint = new solanaWeb3.PublicKey(decodedSwapStateData.initializer_mint);
        takerTokenMint = new solanaWeb3.PublicKey(decodedSwapStateData.swap_mint);
        swapTokenMint = new solanaWeb3.PublicKey(decodedSwapStateData.swap_token_mint);
    } else {
        console.log("Swap Not Initialized");    
        return;
    }

    let vaultTokenMintATA = await splToken.getAssociatedTokenAddress(
        initializerTokenMint,
        swapVaultPDA[0],
        true,
        splToken.TOKEN_PROGRAM_ID,
        splToken.ASSOCIATED_TOKEN_PROGRAM_ID,
    );
    console.log("Vault Token Mint ATA ", vaultTokenMintATA.toString());

    let tokenMetadataPDA = solanaWeb3.PublicKey.findProgramAddressSync(
        [Buffer.from("metadata"), mplToken.PROGRAM_ID.toBytes(), initializerTokenMint.toBytes()],
        mplToken.PROGRAM_ID
    );
    console.log("Token Metadata PDA ", tokenMetadataPDA[0].toString());

    let tokenMasterEditionPDA = solanaWeb3.PublicKey.findProgramAddressSync(
        [Buffer.from("metadata"), mplToken.PROGRAM_ID.toBytes(), initializerTokenMint.toBytes(), Buffer.from("edition")],
        mplToken.PROGRAM_ID
    );
    console.log("Token Master Edition PDA ", tokenMasterEditionPDA[0].toString());

    let tokenDestinationATA = await splToken.getAssociatedTokenAddress(
        initializerTokenMint,
        provider.publicKey,
        false,
        splToken.TOKEN_PROGRAM_ID,
        splToken.ASSOCIATED_TOKEN_PROGRAM_ID,
    );
    console.log("Token Destination ATA ", tokenDestinationATA.toString());

    let createTokenDestinationATA = null;
    let createTokenDestinationATAIx = null;
    await connection.getAccountInfo(
        tokenDestinationATA
    )
    .then(
        function(response) {
            if (response == null) {
                createTokenDestinationATA = true;
                createTokenDestinationATAIx = splToken.createAssociatedTokenAccountInstruction(
                    provider.publicKey,
                    tokenDestinationATA,
                    provider.publicKey,
                    initializerTokenMint,
                    splToken.TOKEN_PROGRAM_ID,
                    splToken.ASSOCIATED_TOKEN_PROGRAM_ID,
                )
                console.log("Create Token Destination ATA Ix: ", createTokenDestinationATAIx);
            } else {
                createTokenDestinationATA = false;
            }
        }
    )
    .catch(
        function(error) {
            error = JSON.stringify(error);
            error = JSON.parse(error);
            console.log("Error: ", error);
            return;
        }
    );

    let tokenRecordPDA = solanaWeb3.PublicKey.findProgramAddressSync(
        [Buffer.from("metadata"), 
        mplToken.PROGRAM_ID.toBytes(),
        initializerTokenMint.toBytes(), 
        Buffer.from("token_record"),
        vaultTokenMintATA.toBytes()],
        mplToken.PROGRAM_ID,
    );
    console.log("Token Record PDA ", tokenRecordPDA[0].toString());

    let tokenRecordDesinationPDA = solanaWeb3.PublicKey.findProgramAddressSync(
        [Buffer.from("metadata"), 
        mplToken.PROGRAM_ID.toBytes(),
        initializerTokenMint.toBytes(), 
        Buffer.from("token_record"),
        tokenDestinationATA.toBytes()],
        mplToken.PROGRAM_ID,
    );
    console.log("Token Record Destination PDA ", tokenRecordDesinationPDA[0].toString());

    let takerTokenMintATA = await splToken.getAssociatedTokenAddress(
        takerTokenMint,
        provider.publicKey,
        false,
        splToken.TOKEN_PROGRAM_ID,
        splToken.ASSOCIATED_TOKEN_PROGRAM_ID,
    );
    console.log("Taker Token Mint ATA ", takerTokenMintATA.toString());

    let takerTokenMetadataPDA = solanaWeb3.PublicKey.findProgramAddressSync(
        [Buffer.from("metadata"), mplToken.PROGRAM_ID.toBytes(), takerTokenMint.toBytes()],
        mplToken.PROGRAM_ID
    );
    console.log("Taker Token Metadata PDA: ", takerTokenMetadataPDA[0].toString());

    let takerTokenMasterEditionPDA = solanaWeb3.PublicKey.findProgramAddressSync(
        [Buffer.from("metadata"), mplToken.PROGRAM_ID.toBytes(), takerTokenMint.toBytes(), Buffer.from("edition")],
        mplToken.PROGRAM_ID
    );
    console.log("Taker Token Master Edition PDA: ", takerTokenMasterEditionPDA[0].toString());

    let takerTokenDestinationATA = await splToken.getAssociatedTokenAddress(
        takerTokenMint,
        initializer,
        false,
        splToken.TOKEN_PROGRAM_ID,
        splToken.ASSOCIATED_TOKEN_PROGRAM_ID,
    );
    console.log("Taker Token Destination ATA ", takerTokenDestinationATA.toString());

    let takerTokenRecordPDA = solanaWeb3.PublicKey.findProgramAddressSync(
        [Buffer.from("metadata"), 
        mplToken.PROGRAM_ID.toBytes(),
        takerTokenMint.toBytes(), 
        Buffer.from("token_record"),
        takerTokenMintATA.toBytes()],
        mplToken.PROGRAM_ID,
    );
    console.log("Taker Token Record PDA ", takerTokenRecordPDA[0].toString());

    let takerTokenRecordDesinationPDA = solanaWeb3.PublicKey.findProgramAddressSync(
        [Buffer.from("metadata"), 
        mplToken.PROGRAM_ID.toBytes(),
        takerTokenMint.toBytes(), 
        Buffer.from("token_record"),
        takerTokenDestinationATA.toBytes()],
        mplToken.PROGRAM_ID,
    );
    console.log("Taker Token Record Destination PDA ", tokenRecordDesinationPDA[0].toString());

    let swapTokenATA = await splToken.getAssociatedTokenAddress(
        swapTokenMint,
        provider.publicKey,
        false,
        splToken.TOKEN_PROGRAM_ID,
        splToken.ASSOCIATED_TOKEN_PROGRAM_ID,
    );
    console.log("Swap Token ATA: ", swapTokenATA.toString());

    let initializerSwapTokenATA = await splToken.getAssociatedTokenAddress(
        swapTokenMint,
        initializer,
        false,
        splToken.TOKEN_PROGRAM_ID,
        splToken.ASSOCIATED_TOKEN_PROGRAM_ID,
    );
    console.log("Initializer Swap Token ATA: ", initializerSwapTokenATA.toString());

    var totalSize = 1;
    console.log("totalSize", totalSize);

    var uarray = new Uint8Array(totalSize);    
    let counter = 0;    
    uarray[counter++] = 1; // 1 = nft_swap SwapNFTs instruction
    console.log("Data: ", uarray);

    const swapPNFTsIx = new solanaWeb3.TransactionInstruction({
        programId: pNFTSwapProgramId,
        data: Buffer.from(
            uarray
        ),
        keys: [
            { pubkey: provider.publicKey, isSigner: true, isWritable: true }, // 0
            { pubkey: initializer, isSigner: false, isWritable: true }, // 1
            { pubkey: programStatePDA[0], isSigner: false, isWritable: false }, // 2
            { pubkey: swapVaultPDA[0], isSigner: false, isWritable: true }, // 3
            { pubkey: swapStatePDA[0], isSigner: false, isWritable: true }, // 4
            { pubkey: vaultTokenMintATA, isSigner: false, isWritable: true }, // 5
            { pubkey: initializerTokenMint, isSigner: false, isWritable: false }, // 6
            { pubkey: tokenMetadataPDA[0], isSigner: false, isWritable: true }, // 7
            { pubkey: tokenMasterEditionPDA[0], isSigner: false, isWritable: false }, // 8
            { pubkey: tokenDestinationATA, isSigner: false, isWritable: true }, // 9
            { pubkey: tokenRecordPDA[0], isSigner: false, isWritable: true }, // 10
            { pubkey: tokenRecordDesinationPDA[0], isSigner: false, isWritable: true }, // 11
            { pubkey: takerTokenMintATA, isSigner: false, isWritable: true }, // 12
            { pubkey: takerTokenMint, isSigner: false, isWritable: false }, // 13
            { pubkey: takerTokenMetadataPDA[0], isSigner: false, isWritable: true }, // 14
            { pubkey: takerTokenMasterEditionPDA[0], isSigner: false, isWritable: false }, // 15
            { pubkey: takerTokenDestinationATA, isSigner: false, isWritable: true }, // 16
            { pubkey: takerTokenRecordPDA[0], isSigner: false, isWritable: true }, // 17
            { pubkey: takerTokenRecordDesinationPDA[0], isSigner: false, isWritable: true }, // 18
            { pubkey: swapTokenATA, isSigner: false, isWritable: true }, // 19
            { pubkey: initializerSwapTokenATA, isSigner: false, isWritable: true }, // 20            
            { pubkey: solanaWeb3.SystemProgram.programId, isSigner: false, isWritable: false }, // 21
            { pubkey: solanaWeb3.SYSVAR_INSTRUCTIONS_PUBKEY, isSigner: false, isWritable: false }, // 22
            { pubkey: splToken.TOKEN_PROGRAM_ID, isSigner: false, isWritable: false }, // 23
            { pubkey: splATAProgramId, isSigner: false, isWritable: false }, // 25
            { pubkey: mplToken.PROGRAM_ID, isSigner: false, isWritable: false }, // 25
            { pubkey: mplAuthRulesProgramId, isSigner: false, isWritable: false }, // 26
            { pubkey: mplAuthRulesAccount, isSigner: false, isWritable: false }, // 27
            { pubkey: devTreasury, isSigner: false, isWritable: true }, // 28
            { pubkey: mcDegensTreasury, isSigner: false, isWritable: true }, // 29
        ]
    });
    console.log("Swap pNFTs Ix: ", swapPNFTsIx);
    
    const computePriceIx = solanaWeb3.ComputeBudgetProgram.setComputeUnitPrice({
        microLamports: 1,
    });

    const computeLimitIx = solanaWeb3.ComputeBudgetProgram.setComputeUnitLimit({
        units: 500000,
    });

    let messageV0 = null;
    if (createTokenDestinationATA == true) {
        messageV0 = new solanaWeb3.TransactionMessage({
            payerKey: provider.publicKey,
            recentBlockhash: (await connection.getRecentBlockhash('confirmed')).blockhash,
            instructions: [
                computePriceIx,
                computeLimitIx,
                createTokenDestinationATAIx,
                swapPNFTsIx,
            ],
        }).compileToV0Message([]);
    } else {
        messageV0 = new solanaWeb3.TransactionMessage({
            payerKey: provider.publicKey,
            recentBlockhash: (await connection.getRecentBlockhash('confirmed')).blockhash,
            instructions: [
                computePriceIx,
                computeLimitIx,
                swapPNFTsIx,
            ],
        }).compileToV0Message([]);
    }

    const swapPNFTsTx = new solanaWeb3.VersionedTransaction(messageV0);
    try {
        let signedTx = await provider.signTransaction(swapPNFTsTx);
        const txId = await connection.sendTransaction(signedTx);
        console.log("Signature: ", txId)
        console.log(`https://solscan.io/tx/${txId}?cluster=mainnet`);
    } catch(error) {
        console.log("Error: ", error)
        error = JSON.stringify(error);
        error = JSON.parse(error);
        console.log("Error Logs: ", error)
        return;
    }
}

async function ReverseSwap() {
    if (!wallet_initialized) {
        console.log("Error, wallet not initialized");
        return
    }
    console.log("Connected to wallet");
    console.log("Provider Pubkey: ", provider.publicKey.toString());

    // These are passed
    let mint = "HAe5tW4P91bRK13Qi873DGCdeh37Sm9Z362n4ibPWg8r";
    // let swapMint = "4m3hQZh3QXHjUUFjN7UtGACcAQjrRyD9mAMZhCfjwnwy";
    let swapMint = "11111111111111111111111111111111";

    let pNFTSwapProgramId = new solanaWeb3.PublicKey("2bY36scRMEUJHJToVGjJ2uY8PdSrRPr73siNwGbv1ZNT");
    let splATAProgramId = new solanaWeb3.PublicKey("ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL");
    let mplAuthRulesProgramId = new solanaWeb3.PublicKey("auth9SigNpDKz4sJJ1DfCTuZrZNSAgh9sFD3rboVmgg");
    let mplAuthRulesAccount = new solanaWeb3.PublicKey("eBJLFYPxJmMGKuFwpDWkzxZeUrad92kZRC5BJLpzyT9");
    
    let swapVaultPDA = solanaWeb3.PublicKey.findProgramAddressSync(
        [Buffer.from("swap-vault")],
        pNFTSwapProgramId
    );
    console.log("Swap Vault PDA: ", swapVaultPDA[0].toString());

    let swapStatePDA = solanaWeb3.PublicKey.findProgramAddressSync(
        [Buffer.from("swap-state"), new solanaWeb3.PublicKey(mint).toBytes(), new solanaWeb3.PublicKey(swapMint).toBytes()],
        pNFTSwapProgramId
    );
    console.log("Swap State PDA: ", swapStatePDA[0].toString());

    let swapState = null;
    await connection.getAccountInfo(
        swapStatePDA[0]
    )
    .then(
        function(response) {
            swapState = response;
        }
    )
    .catch(
        function(error) {
            error = JSON.stringify(error);
            error = JSON.parse(error);
            console.log("Error: ", error);
            return;
        }
    );

    if (swapState != null) {
        const encodedSwapStateData = swapState.data;
        const decodedSwapStateData = SWAP_STATE.decode(
            encodedSwapStateData
        );
        console.log("swapState - is_initialized: ", decodedSwapStateData.is_initialized);
        console.log("swapState - initializer: ", new solanaWeb3.PublicKey(decodedSwapStateData.initializer).toString());
        console.log("swapState - initializer_mint: ", new solanaWeb3.PublicKey(decodedSwapStateData.initializer_mint).toString());
        console.log("swapState - swap_mint: ", new solanaWeb3.PublicKey(decodedSwapStateData.swap_mint).toString());
        console.log("swapState - swap_lamports", new BN(decodedSwapStateData.swap_lamports, 10, "le").toString());
        console.log("swapState - swap_token_mint", new solanaWeb3.PublicKey(decodedSwapStateData.swap_token_mint).toString());
        console.log("swapState - swap_tokens", new BN(decodedSwapStateData.swap_tokens, 10, "le").toString());        
    } else {
        console.log("Swap Not Initialized");    
        return;
    }

    let vaultMintATA = await splToken.getAssociatedTokenAddress(
        new solanaWeb3.PublicKey(mint),
        swapVaultPDA[0],
        true,
        splToken.TOKEN_PROGRAM_ID,
        splToken.ASSOCIATED_TOKEN_PROGRAM_ID,
    );
    console.log("Vault Mint ATA ", vaultMintATA.toString());

    let tokenMetadataPDA = solanaWeb3.PublicKey.findProgramAddressSync(
        [Buffer.from("metadata"), mplToken.PROGRAM_ID.toBytes(), new solanaWeb3.PublicKey(mint).toBytes()],
        mplToken.PROGRAM_ID
    );
    console.log("Token Metadata PDA: ", tokenMetadataPDA[0].toString());

    let tokenMasterEditionPDA = solanaWeb3.PublicKey.findProgramAddressSync(
        [Buffer.from("metadata"), mplToken.PROGRAM_ID.toBytes(), new solanaWeb3.PublicKey(mint).toBytes(), Buffer.from("edition")],
        mplToken.PROGRAM_ID
    );
    console.log("Token Master Edition PDA: ", tokenMasterEditionPDA[0].toString());

    let tokenDestinationATA = await splToken.getAssociatedTokenAddress(
        new solanaWeb3.PublicKey(mint),
        provider.publicKey,
        false,
        splToken.TOKEN_PROGRAM_ID,
        splToken.ASSOCIATED_TOKEN_PROGRAM_ID,
    );
    console.log("Token Destination ATA ", tokenDestinationATA);

    let tokenRecordPDA = solanaWeb3.PublicKey.findProgramAddressSync(
        [Buffer.from("metadata"), 
        new solanaWeb3.PublicKey(mplToken.PROGRAM_ID).toBytes(),
        new solanaWeb3.PublicKey(mint).toBytes(), 
        Buffer.from("token_record"),
        new solanaWeb3.PublicKey(vaultMintATA).toBytes()],
        mplToken.PROGRAM_ID,
    );
    console.log("Token Record PDA ", tokenRecordPDA[0].toString());

    let tokenRecordDesinationPDA = solanaWeb3.PublicKey.findProgramAddressSync(
        [Buffer.from("metadata"), 
        new solanaWeb3.PublicKey(mplToken.PROGRAM_ID).toBytes(),
        new solanaWeb3.PublicKey(mint).toBytes(), 
        Buffer.from("token_record"),
        new solanaWeb3.PublicKey(tokenDestinationATA).toBytes()],
        mplToken.PROGRAM_ID,
    );
    console.log("Token Record Destination PDA ", tokenRecordDesinationPDA[0].toString());

    var totalSize = 1 + 32;
    console.log("totalSize", totalSize);

    var uarray = new Uint8Array(totalSize);    
    let counter = 0;    
    uarray[counter++] = 2; // 2 = nft_swap ReverseSwap instruction

    let swapMintb58 = bs58.decode(swapMint);
    var arr = Array.prototype.slice.call(Buffer.from(swapMintb58), 0);
    for (let i = 0; i < arr.length; i++) {
        uarray[counter++] = arr[i];
    }

    console.log("Data: ", uarray);

    const reverseSwapIx = new solanaWeb3.TransactionInstruction({
        programId: pNFTSwapProgramId,
        data: Buffer.from(
            uarray
        ),
        keys: [
            { pubkey: provider.publicKey, isSigner: true, isWritable: true }, // 0
            { pubkey: swapVaultPDA[0], isSigner: false, isWritable: true }, // 1
            { pubkey: swapStatePDA[0], isSigner: false, isWritable: true }, // 2
            { pubkey: vaultMintATA, isSigner: false, isWritable: true }, // 3
            { pubkey: new solanaWeb3.PublicKey(mint), isSigner: false, isWritable: false }, // 4
            { pubkey: tokenMetadataPDA[0], isSigner: false, isWritable: true }, // 5
            { pubkey: tokenMasterEditionPDA[0], isSigner: false, isWritable: false }, // 6
            { pubkey: tokenDestinationATA, isSigner: false, isWritable: true }, // 7
            { pubkey: tokenRecordPDA[0], isSigner: false, isWritable: true }, // 8
            { pubkey: tokenRecordDesinationPDA[0], isSigner: false, isWritable: true }, // 9
            { pubkey: solanaWeb3.SystemProgram.programId, isSigner: false, isWritable: false }, // 10
            { pubkey: solanaWeb3.SYSVAR_INSTRUCTIONS_PUBKEY, isSigner: false, isWritable: false }, // 11
            { pubkey: splToken.TOKEN_PROGRAM_ID, isSigner: false, isWritable: false }, // 12
            { pubkey: splATAProgramId, isSigner: false, isWritable: false }, // 13
            { pubkey: mplToken.PROGRAM_ID, isSigner: false, isWritable: false }, // 14
            { pubkey: mplAuthRulesProgramId, isSigner: false, isWritable: false }, // 15
            { pubkey: mplAuthRulesAccount, isSigner: false, isWritable: false }, // 16
        ]
    });
    console.log("Reverse Swap Ix: ", reverseSwapIx);
    
    const computePriceIx = solanaWeb3.ComputeBudgetProgram.setComputeUnitPrice({
        microLamports: 1,
    });

    const computeLimitIx = solanaWeb3.ComputeBudgetProgram.setComputeUnitLimit({
        units: 250000,
    });

    let messageV0 = new solanaWeb3.TransactionMessage({
        payerKey: provider.publicKey,
        recentBlockhash: (await connection.getRecentBlockhash('confirmed')).blockhash,
        instructions: [computePriceIx, computeLimitIx, reverseSwapIx],
    }).compileToV0Message([]);

    const reverseSwapTx = new solanaWeb3.VersionedTransaction(messageV0);
    try {
        let signedTx = await provider.signTransaction(reverseSwapTx);
        const txId = await connection.sendTransaction(signedTx);
        console.log("Signature: ", txId)
        console.log(`https://solscan.io/tx/${txId}?cluster=mainnet`);
    } catch(error) {
        console.log("Error: ", error)
        error = JSON.stringify(error);
        error = JSON.parse(error);
        console.log("Error Logs: ", error)
        return;
    }    
}

async function UpdateState() { 
    if (!wallet_initialized) {
        console.log("Error, wallet not initialized");
        return
    }
    console.log("Connected to wallet");
    console.log("Provider Pubkey: ", provider.publicKey.toString());

    // These are passed
    let newFeeLamports = 25000000; // 0
    let newDevPercentage = 75; // 0
    let newDevTreasury = "6WFx4hKGwT85oBGwfq9fSgyvmmWqEZrXZaNVWUtRZYna"; // "11111111111111111111111111111111"
    let newMcDegensTreasury = "GUFxwDrsLzSQ27xxTVe4y9BARZ6cENWmjzwe8XPy7AKu";

    let pNFTSwapProgramId = new solanaWeb3.PublicKey("2bY36scRMEUJHJToVGjJ2uY8PdSrRPr73siNwGbv1ZNT");

    let programStatePDA = solanaWeb3.PublicKey.findProgramAddressSync(
        [Buffer.from("program-state")],
        pNFTSwapProgramId
    );
    console.log("Program State PDA: ", programStatePDA[0].toString());

    var totalSize = 1 + 8 + 1 + 32 + 32;
    console.log("totalSize", totalSize);

    var uarray = new Uint8Array(totalSize);    
    let counter = 0;
    
    uarray[counter++] = 3; // 3 =  nft_swap UpdateState instruction

    var byteArray = [0, 0, 0, 0, 0, 0, 0, 0];
    for ( var index = 0; index < byteArray.length; index ++ ) {
        var byte = newFeeLamports & 0xff;
        byteArray [ index ] = byte;
        newFeeLamports = (newFeeLamports - byte) / 256 ;
    }
    for (let i = 0; i < byteArray.length; i++) {
        uarray[counter++] = byteArray[i];
    }

    uarray[counter++] = newDevPercentage;

    let newDevTreasuryb58 = bs58.decode(newDevTreasury);
    var arr = Array.prototype.slice.call(Buffer.from(newDevTreasuryb58), 0);
    for (let i = 0; i < arr.length; i++) {
        uarray[counter++] = arr[i];
    }

    let newMcDegensTreasuryb58 = bs58.decode(newMcDegensTreasury);
    var arr = Array.prototype.slice.call(Buffer.from(newMcDegensTreasuryb58), 0);
    for (let i = 0; i < arr.length; i++) {
        uarray[counter++] = arr[i];
    }

    console.log("Data: ", uarray);
    
    const pNFTSwapUpdateStateTx = new solanaWeb3.TransactionInstruction({
        programId: pNFTSwapProgramId,
        data: Buffer.from(
            uarray
        ),
        keys: [
            { pubkey: provider.publicKey, isSigner: true, isWritable: true }, // 0
            { pubkey: programStatePDA[0], isSigner: false, isWritable: true }, // 1
            { pubkey: solanaWeb3.SystemProgram.programId, isSigner: false, isWritable: false }, // 2
        ],        
    });
    console.log("pNFT Swap Update State Tx: ", pNFTSwapUpdateStateTx);

    let tx = new solanaWeb3.Transaction();
    tx.add(pNFTSwapUpdateStateTx);
    tx.recentBlockhash = (await connection.getRecentBlockhash('confirmed')).blockhash;
    tx.feePayer = provider.publicKey;
    console.log("Start Tx")
    try {
        let signedTransaction = await provider.signTransaction(tx);
        console.log("Tx: ", tx);
        const serializedTransaction = signedTransaction.serialize();
        const signature = await connection.sendRawTransaction(
            serializedTransaction,
            { skipPreflight: false, preflightCommitment: 'confirmed' },
        );        
        console.log("Signature: ", signature)
    } catch(error) {
        console.log("Error: ", error)
        error = JSON.stringify(error);
        error = JSON.parse(error);
        console.log("Error Logs: ", error)
    }
}

async function ReadpNFT(){
    if (!wallet_initialized) {
        console.log("Error, wallet not initialized");
        return
    }
    console.log("Connected to wallet");
    console.log("Provider Pubkey: ", provider.publicKey.toString());

    // These are passed
    let mint = new solanaWeb3.PublicKey("HAe5tW4P91bRK13Qi873DGCdeh37Sm9Z362n4ibPWg8r");
    console.log("Mint ", mint.toString());

    let metadataProgramId = new solanaWeb3.PublicKey("metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s");

    await connection.getAccountInfo(mint)
    .then(
        function(response) {
            console.log("response ", response);
            if (response == null) {
                console.log("No info");
            } else {
                const decodedData = splToken.MintLayout.decode(response.data);
                console.log(decodedData.mintAuthorityOption);
                console.log(decodedData.mintAuthority.toString());
                console.log(decodedData.decimals);
                console.log(decodedData.isInitialized);
                console.log(decodedData.freezeAuthorityOption);
                console.log(decodedData.freezeAuthority.toString());
            }
        }
    )
    .catch(
        function(error) {
            error = JSON.stringify(error);
            error = JSON.parse(error);
            console.log("Error: ", error);
            return;
        }
    );

    let providerMintATA = await splToken.getAssociatedTokenAddress(
        mint,
        provider.publicKey,
        false,
        splToken.TOKEN_PROGRAM_ID,
        splToken.ASSOCIATED_TOKEN_PROGRAM_ID,
    );
    console.log("providerMintATA ", providerMintATA.toString());

    await connection.getAccountInfo(providerMintATA)
    .then(
        function(response) {
            console.log("response ", response);
            if (response == null) {
                console.log("No info");
            } else {
                const decodedData = ATA_STATE.decode(response.data);
                console.log(decodedData);
            }
        }
    )
    .catch(
        function(error) {
            error = JSON.stringify(error);
            error = JSON.parse(error);
            console.log("Error: ", error);
            return;
        }
    );

    let tokenRecordAccount = solanaWeb3.PublicKey.findProgramAddressSync(
        [Buffer.from("metadata"), 
        new solanaWeb3.PublicKey(metadataProgramId).toBytes(),
        new solanaWeb3.PublicKey(mint).toBytes(), 
        Buffer.from("token_record"),
        new solanaWeb3.PublicKey(providerMintATA).toBytes()],
        metadataProgramId,
    );
    console.log("Token Record PDA: ", tokenRecordAccount[0].toString());

    await connection.getAccountInfo(providerMintATA)
    .then(
        function(response) {
            console.log("response ", response);
            if (response == null) {
                console.log("No info");
            } else {
                const decodedData = TOKEN_RECORD_STATE.decode(response.data);
                console.log(decodedData);
                console.log(decodedData.key);
                console.log(decodedData.bump);
                console.log(decodedData.token_state);
                console.log(decodedData.ruleset_revision);
                console.log(bs58.decode(decodedData.delegate));
                console.log(decodedData.delegate_role);
            }
        }
    )
    .catch(
        function(error) {
            error = JSON.stringify(error);
            error = JSON.parse(error);
            console.log("Error: ", error);
            return;
        }
    );
}

$('#thingButton').on('click', () => {
    console.log('Working ...');
    // InitializeSwap();
    SwapPNFTs();
    // ReverseSwap();
    // UpdateState();
    // ReadpNFT();
});
$('#thingButton').prop('disabled', true);

$(window).on('load', async () => {
    await connectRPC();
});