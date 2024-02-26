import * as solanaWeb3 from "@solana/web3.js";
import * as splToken from "@solana/spl-token";
import $ from 'jquery';
import BN from "bn.js";
import * as bs58 from "bs58";
import * as buffer from "buffer";
window.Buffer = buffer.Buffer;
import * as BufferLayout from 'buffer-layout';

const publicKey = (property = "publicKey") => {
    return BufferLayout.blob(32, property);
};  
const uint64 = (property = "uint64") => {
    return BufferLayout.blob(8, property);
};  

const PROGRAM_STATE = BufferLayout.struct([
    BufferLayout.u8("is_initialized"),
    publicKey("pickle_mint"),
    uint64("fee_chips"),
    BufferLayout.u8("dev_percentage"),
    publicKey("dev_treasury"),
    publicKey("mcdegens_treasury"),
]);

const SWAP_STATE = BufferLayout.struct([
    BufferLayout.u8("is_initialized"),
    uint64("utime"),  // HERE
    publicKey("initializer"),
    publicKey("token1_mint"),
    uint64("token1_amount"),    
    publicKey("temp_token1_account"),
    publicKey("token2_mint"),
    uint64("token2_amount"),    
    publicKey("temp_token2_account"),
    publicKey("taker"),
    publicKey("token3_mint"),
    uint64("token3_amount"),
    publicKey("token4_mint"),
    uint64("token4_amount"),
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
    let taker = "CNcovwf5CbuMHVDofbDVxTtsEAQxmWUgfGeQDS3MnmWH";
    let token1Mint = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
    let token1Amount = 1000;
    let token2Mint = "BSNvgNM2EE4fwQJjyXwxj3KZmKkx13D17WeGkevgiFaw"; //"11111111111111111111111111111111"; use when no token2
    let token2Amount = 350000000;
    let token3Mint = "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263"; //"11111111111111111111111111111111"; use for SOL
    let token3Amount = 1000;
    let token4Mint = "AmgUMQeqW8H74trc8UkKjzZWtxBdpS496wh4GLy2mCpo"; //"11111111111111111111111111111111"; use when no token4
    let token4Amount = 100;
    console.log("taker ", taker);
    console.log("token1Mint ", token1Mint);
    console.log("token1Amount", token1Amount);
    console.log("token2Mint ", token2Mint);
    console.log("token2Amount", token2Amount);
    console.log("token3Mint ", token3Mint);
    console.log("token3Amount", token3Amount);
    console.log("token4Mint ", token4Mint);
    console.log("token4Amount", token4Amount);

    let tokenSwapProgramId = new solanaWeb3.PublicKey("AAyM7XH9w7ApeSuEat8AwUW1AA7dBuj2vXv7SuUGpNUp");  // HERE
    // let tokenSwapProgramId = new solanaWeb3.PublicKey("GbowtzP1XpAK2as84UgGWTpn4o7QoiAeFNM8yRRBjeSk");
    
    let programStatePDA = solanaWeb3.PublicKey.findProgramAddressSync(
        [Buffer.from("program-state")],
        tokenSwapProgramId
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

    let pickleMint = null;
    let feeChips = null;
    let devTreasury = null;
    let mcDegensTreasury = null;
    if (programState != null) {
        const encodedProgramStateData = programState.data;
        const decodedProgramStateData = PROGRAM_STATE.decode(
            encodedProgramStateData
        );
        console.log("programState - is_initialized: ", decodedProgramStateData.is_initialized);
        console.log("programState - pickle_mint: ", new solanaWeb3.PublicKey(decodedProgramStateData.pickle_mint).toString());
        console.log("programState - fee_chips: ", new BN(decodedProgramStateData.fee_chips, 10, "le").toString());
        console.log("programState - dev_percentage: ", new BN(decodedProgramStateData.dev_percentage, 10, "le").toString());
        console.log("programState - dev_treasury: ", new solanaWeb3.PublicKey(decodedProgramStateData.dev_treasury).toString());
        console.log("programState - mcdegens_treasury: ", new solanaWeb3.PublicKey(decodedProgramStateData.mcdegens_treasury).toString());

        pickleMint = new solanaWeb3.PublicKey(decodedProgramStateData.pickle_mint);
        feeChips = new BN(decodedProgramStateData.fee_chips, 10, "le");
        devTreasury = new solanaWeb3.PublicKey(decodedProgramStateData.dev_treasury);
        mcDegensTreasury = new solanaWeb3.PublicKey(decodedProgramStateData.mcdegens_treasury);
    } else {
        console.log("Program State Not Initialized");    
        return;
    }
    
    let swapVaultPDA = solanaWeb3.PublicKey.findProgramAddressSync(
        [Buffer.from("swap-vault")],
        tokenSwapProgramId
    );
    console.log("Swap Vault PDA: ", swapVaultPDA[0].toString());

    let swapStatePDA = solanaWeb3.PublicKey.findProgramAddressSync(
        [Buffer.from("swap-state"), provider.publicKey.toBytes(), new solanaWeb3.PublicKey(taker).toBytes()],
        tokenSwapProgramId
    );
    console.log("Swap State PDA: ", swapStatePDA[0].toString());

    //  HERE
    // const tempFeeAccount = new solanaWeb3.Keypair();
    // console.log("Temp Fee Account: ", tempFeeAccount.publicKey.toString());
    // let createTempFeeAccountIx = solanaWeb3.SystemProgram.createAccount({
    //     programId: splToken.TOKEN_PROGRAM_ID,
    //     space: splToken.AccountLayout.span,
    //     lamports: await connection.getMinimumBalanceForRentExemption(
    //         splToken.AccountLayout.span
    //     ),
    //     fromPubkey: provider.publicKey,
    //     newAccountPubkey: tempFeeAccount.publicKey,
    // });    
    // console.log("Create Temp Fee Account Ix: ", createTempFeeAccountIx);    
    
    // let initTempFeeAccountIx = splToken.createInitializeAccountInstruction(
    //     tempFeeAccount.publicKey,
    //     new solanaWeb3.PublicKey(pickleMint),
    //     tempFeeAccount.publicKey,
    //     splToken.TOKEN_PROGRAM_ID
    // );
    // console.log("Init Temp Fee Account Ix: ", initTempFeeAccountIx);

    let providerPickleATA = await splToken.getAssociatedTokenAddress(
        new solanaWeb3.PublicKey(pickleMint),
        provider.publicKey,
        false,
        splToken.TOKEN_PROGRAM_ID,
        splToken.ASSOCIATED_TOKEN_PROGRAM_ID,
    );

    //  HERE
    // let transferPickleIx = splToken.createTransferInstruction(
    //     providerPickleATA,
    //     tempFeeAccount.publicKey,
    //     provider.publicKey,
    //     feeChips,
    //     provider.publicKey,
    //     splToken.TOKEN_PROGRAM_ID,
    // )
    // console.log("Transfer Pickle Ix: ", transferPickleIx);

    const tempToken1Account = new solanaWeb3.Keypair();
    console.log("Temp Token1 Account: ", tempToken1Account.publicKey.toString());
    let rent = await connection.getMinimumBalanceForRentExemption(splToken.AccountLayout.span);
    let createTempToken1AccountIx = solanaWeb3.SystemProgram.createAccount({
        programId: splToken.TOKEN_PROGRAM_ID,
        space: splToken.AccountLayout.span,
        lamports: rent,
        fromPubkey: provider.publicKey,
        newAccountPubkey: tempToken1Account.publicKey,
    });    
    console.log("Create Temp Token1 Account Ix: ", createTempToken1AccountIx);    

    let initTempToken1AccountIx = splToken.createInitializeAccountInstruction(
        tempToken1Account.publicKey,
        new solanaWeb3.PublicKey(token1Mint),
        tempToken1Account.publicKey,
        splToken.TOKEN_PROGRAM_ID
    );
    console.log("Init Temp Token1 Account Ix: ", initTempToken1AccountIx);

    let providerToken1ATA = await splToken.getAssociatedTokenAddress(
        new solanaWeb3.PublicKey(token1Mint),
        provider.publicKey,
        false,
        splToken.TOKEN_PROGRAM_ID,
        splToken.ASSOCIATED_TOKEN_PROGRAM_ID,
    );    
    let transferToken1Ix = splToken.createTransferInstruction(
        providerToken1ATA,
        tempToken1Account.publicKey,
        provider.publicKey,
        token1Amount,
        provider.publicKey,
        splToken.TOKEN_PROGRAM_ID,
    )
    console.log("Transfer Token1 Ix: ", transferToken1Ix);

    let tempToken2Account = new solanaWeb3.Keypair();
    let createTempToken2AccountIx = null;
    let initTempToken2AccountIx = null;
    let transferToken2Ix = null;
    rent = await connection.getMinimumBalanceForRentExemption(splToken.AccountLayout.span);
    if (token2Amount > 0) {
        console.log("Temp Token2 Account: ", tempToken2Account.publicKey.toString());
        createTempToken2AccountIx = solanaWeb3.SystemProgram.createAccount({
            programId: splToken.TOKEN_PROGRAM_ID,
            space: splToken.AccountLayout.span,
            lamports: rent,
            fromPubkey: provider.publicKey,
            newAccountPubkey: tempToken2Account.publicKey,
        });    
        console.log("Create Temp Token2 Account Ix: ", createTempToken2AccountIx);    

        initTempToken2AccountIx = splToken.createInitializeAccountInstruction(
            tempToken2Account.publicKey,
            new solanaWeb3.PublicKey(token2Mint),
            tempToken2Account.publicKey,
            splToken.TOKEN_PROGRAM_ID
        );
        console.log("Init Temp Token2 Account Ix: ", initTempToken2AccountIx);

        let providerToken2ATA = await splToken.getAssociatedTokenAddress(
            new solanaWeb3.PublicKey(token2Mint),
            provider.publicKey,
            false,
            splToken.TOKEN_PROGRAM_ID,
            splToken.ASSOCIATED_TOKEN_PROGRAM_ID,
        );    
        transferToken2Ix = splToken.createTransferInstruction(
            providerToken2ATA,
            tempToken2Account.publicKey,
            provider.publicKey,
            token2Amount,
            provider.publicKey,
            splToken.TOKEN_PROGRAM_ID,
        )
        console.log("Transfer Token2 Ix: ", transferToken2Ix);
    }

    let createToken3ATA = null; 
    let createToken3ATAIx = null;
    let token3ATA = null;
    if (token3Mint != "11111111111111111111111111111111") {
        token3ATA = await splToken.getAssociatedTokenAddress(
            new solanaWeb3.PublicKey(token3Mint),
            provider.publicKey,
            false,
            splToken.TOKEN_PROGRAM_ID,
            splToken.ASSOCIATED_TOKEN_PROGRAM_ID,
        );
        console.log("Token3 ATA: ", token3ATA.toString());    

        await connection.getAccountInfo(
            token3ATA
        )
        .then(
            function(response) {
                console.log("token3ATA response ", response);
                if (response == null) {
                    createToken3ATA = true;
                    createToken3ATAIx = splToken.createAssociatedTokenAccountInstruction(
                        provider.publicKey,
                        token3ATA,
                        provider.publicKey,
                        new solanaWeb3.PublicKey(token3Mint),
                        splToken.TOKEN_PROGRAM_ID,
                        splToken.ASSOCIATED_TOKEN_PROGRAM_ID,
                    )
                    console.log("Create Token3 ATA Ix: ", createToken3ATAIx); 
                } else {
                    createToken3ATA = false;
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

    let createToken4ATA = false;
    let token4ATA = null;
    let createToken4ATAIx = null;
    if (token4Amount > 0) {
        token4ATA = await splToken.getAssociatedTokenAddress(
            new solanaWeb3.PublicKey(token4Mint),
            provider.publicKey,
            false,
            splToken.TOKEN_PROGRAM_ID,
            splToken.ASSOCIATED_TOKEN_PROGRAM_ID,
        );
        console.log("Token4 ATA: ", token4ATA.toString());
        
        await connection.getAccountInfo(
            token4ATA
        )
        .then(
            function(response) {
                console.log("token4ATA response ", response);
                if (response == null) {
                    createToken4ATA = true;
                    createToken4ATAIx = splToken.createAssociatedTokenAccountInstruction(
                        provider.publicKey,
                        token4ATA,
                        provider.publicKey,
                        new solanaWeb3.PublicKey(token4Mint),
                        splToken.TOKEN_PROGRAM_ID,
                        splToken.ASSOCIATED_TOKEN_PROGRAM_ID,
                    )
                    console.log("Create Token4 ATA Ix: ", createToken4ATAIx); 
                } else {
                    createToken4ATA = false;
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
            
    var totalSize = 1 + 32 + 8 + 32 + 8 + 32 + 8;
    console.log("totalSize", totalSize);

    var uarray = new Uint8Array(totalSize);
    let counter = 0;    
    uarray[counter++] = 0; // 0 = token_swap InitializeSwap instruction
    
    let takerb58 = bs58.decode(taker);
    var arr = Array.prototype.slice.call(Buffer.from(takerb58), 0);
    for (let i = 0; i < arr.length; i++) {
        uarray[counter++] = arr[i];
    }
    
    let token2 = token2Amount;
    var byteArray = [0, 0, 0, 0, 0, 0, 0, 0];
    for ( var index = 0; index < byteArray.length; index ++ ) {
        var byte = token2 & 0xff;
        byteArray [ index ] = byte;
        token2 = (token2 - byte) / 256 ;
    }
    for (let i = 0; i < byteArray.length; i++) {
        uarray[counter++] = byteArray[i];
    }

    let token3Mintb58 = bs58.decode(token3Mint);
    var arr = Array.prototype.slice.call(Buffer.from(token3Mintb58), 0);
    for (let i = 0; i < arr.length; i++) {
        uarray[counter++] = arr[i];
    }

    var byteArray = [0, 0, 0, 0, 0, 0, 0, 0];
    for ( var index = 0; index < byteArray.length; index ++ ) {
        var byte = token3Amount & 0xff;
        byteArray [ index ] = byte;
        token3Amount = (token3Amount - byte) / 256 ;
    }
    for (let i = 0; i < byteArray.length; i++) {
        uarray[counter++] = byteArray[i];
    }

    let token4Mintb58 = bs58.decode(token4Mint.toString());
    var arr = Array.prototype.slice.call(Buffer.from(token4Mintb58), 0);
    for (let i = 0; i < arr.length; i++) {
        uarray[counter++] = arr[i];
    }

    var byteArray = [0, 0, 0, 0, 0, 0, 0, 0];
    for ( var index = 0; index < byteArray.length; index ++ ) {
        var byte = token4Amount & 0xff;
        byteArray [ index ] = byte;
        token4Amount = (token4Amount - byte) / 256 ;
    }
    for (let i = 0; i < byteArray.length; i++) {
        uarray[counter++] = byteArray[i];
    }

    console.log("Contract Data: ", uarray);

    const initializeSwapIx = new solanaWeb3.TransactionInstruction({
        programId: tokenSwapProgramId,
        data: Buffer.from(
            uarray
        ),
        keys: [
            { pubkey: provider.publicKey, isSigner: true, isWritable: true }, // 0
            { pubkey: programStatePDA[0], isSigner: false, isWritable: false }, // 1
            { pubkey: swapVaultPDA[0], isSigner: false, isWritable: false }, // 2
            { pubkey: swapStatePDA[0], isSigner: false, isWritable: true }, // 3            
            { pubkey: tempToken1Account.publicKey, isSigner: true, isWritable: true }, // 4
            { pubkey: tempToken2Account.publicKey, isSigner: true, isWritable: true }, // 5
            { pubkey: providerPickleATA, isSigner: false, isWritable: true }, // 6  HERE
            // { pubkey: tempFeeAccount.publicKey, isSigner: true, isWritable: true }, // 6  HERE
            { pubkey: solanaWeb3.SystemProgram.programId, isSigner: false, isWritable: false }, // 7
            { pubkey: splToken.TOKEN_PROGRAM_ID, isSigner: false, isWritable: false }, // 8
            { pubkey: devTreasury, isSigner: false, isWritable: true }, // 9
            { pubkey: mcDegensTreasury, isSigner: false, isWritable: true }, // 10
        ]
    });
    console.log("Initialize Swap Ix: ", initializeSwapIx);

    // let lookupTable = new solanaWeb3.PublicKey("2EruzbDM8KDoiaSQFX9eWzU8ttQnM6PfixCCfjzqmocR"); // devnet
    let lookupTable = new solanaWeb3.PublicKey("DnDkh579fNnBFUwLDeQWgfW6ukLMyt8DgLaVDVwecxmj"); // mainnet    
	const lookupTableAccount = await connection
		.getAddressLookupTable(lookupTable)
		.then((res) => res.value);
    if (!lookupTableAccount) {
        console.log("Could not fetch ALT!");
        return;
    }    

    let messageV0 = null;
    if (token2Amount > 0) {
        if (createToken3ATA == true && createToken4ATA) {
            console.log("1");
            messageV0 = new solanaWeb3.TransactionMessage({
                payerKey: provider.publicKey,
                recentBlockhash: (await connection.getRecentBlockhash('confirmed')).blockhash,
                instructions: [
                    // createTempFeeAccountIx,  // HERE
                    // initTempFeeAccountIx,
                    // transferPickleIx,
                    createTempToken1AccountIx,
                    initTempToken1AccountIx,
                    transferToken1Ix,
                    createTempToken2AccountIx,
                    initTempToken2AccountIx,
                    transferToken2Ix,            
                    createToken3ATAIx,
                    createToken4ATAIx,
                    initializeSwapIx             
                ],
            }).compileToV0Message([lookupTableAccount]);
        } else if (createToken3ATA) {
            console.log("2");
            messageV0 = new solanaWeb3.TransactionMessage({
                payerKey: provider.publicKey,
                recentBlockhash: (await connection.getRecentBlockhash('confirmed')).blockhash,
                instructions: [
                    // createTempFeeAccountIx,  // HERE
                    // initTempFeeAccountIx,
                    // transferPickleIx,
                    createTempToken1AccountIx,
                    initTempToken1AccountIx,
                    transferToken1Ix,
                    createTempToken2AccountIx,
                    initTempToken2AccountIx,
                    transferToken2Ix,            
                    createToken3ATAIx,
                    initializeSwapIx
                ],
            }).compileToV0Message([lookupTableAccount]);
        } else if (createToken4ATA) {
            console.log("3");
            messageV0 = new solanaWeb3.TransactionMessage({
                payerKey: provider.publicKey,
                recentBlockhash: (await connection.getRecentBlockhash('confirmed')).blockhash,
                instructions: [
                    // createTempFeeAccountIx,  // HERE
                    // initTempFeeAccountIx,
                    // transferPickleIx,
                    createTempToken1AccountIx,
                    initTempToken1AccountIx,
                    transferToken1Ix,
                    createTempToken2AccountIx,
                    initTempToken2AccountIx,
                    transferToken2Ix,            
                    createToken4ATAIx,
                    initializeSwapIx                
                ],
            }).compileToV0Message([lookupTableAccount]);
        } else {
            console.log("4");
            messageV0 = new solanaWeb3.TransactionMessage({
                payerKey: provider.publicKey,
                recentBlockhash: (await connection.getRecentBlockhash('confirmed')).blockhash,
                instructions: [
                    // createTempFeeAccountIx,  // HERE
                    // initTempFeeAccountIx,
                    // transferPickleIx,
                    createTempToken1AccountIx,
                    initTempToken1AccountIx,
                    transferToken1Ix,
                    createTempToken2AccountIx,
                    initTempToken2AccountIx,
                    transferToken2Ix,
                    initializeSwapIx,         
                ],
            }).compileToV0Message([lookupTableAccount]);
        }
    } else {        
        if (createToken3ATA == true && createToken4ATA == true) {
            console.log("5");
            messageV0 = new solanaWeb3.TransactionMessage({
                payerKey: provider.publicKey,
                recentBlockhash: (await connection.getRecentBlockhash('confirmed')).blockhash,
                instructions: [
                    // createTempFeeAccountIx,  // HERE
                    // initTempFeeAccountIx,
                    // transferPickleIx,
                    createTempToken1AccountIx,
                    initTempToken1AccountIx,
                    transferToken1Ix,
                    createToken3ATAIx,
                    createToken4ATAIx,
                    initializeSwapIx                   
                ],
            }).compileToV0Message([lookupTableAccount]);
        } else if (createToken3ATA) {
            console.log("6");
            messageV0 = new solanaWeb3.TransactionMessage({
                payerKey: provider.publicKey,
                recentBlockhash: (await connection.getRecentBlockhash('confirmed')).blockhash,
                instructions: [
                    // createTempFeeAccountIx,  // HERE
                    // initTempFeeAccountIx,
                    // transferPickleIx,
                    createTempToken1AccountIx,
                    initTempToken1AccountIx,
                    transferToken1Ix,
                    createToken3ATAIx,
                    initializeSwapIx
                ],
            }).compileToV0Message([lookupTableAccount]);
        } else if (createToken4ATA) {
            console.log("7");
            messageV0 = new solanaWeb3.TransactionMessage({
                payerKey: provider.publicKey,
                recentBlockhash: (await connection.getRecentBlockhash('confirmed')).blockhash,
                instructions: [
                    // createTempFeeAccountIx,  // HERE
                    // initTempFeeAccountIx,
                    // transferPickleIx,
                    createTempToken1AccountIx,
                    initTempToken1AccountIx,
                    transferToken1Ix,
                    createToken4ATAIx,
                    initializeSwapIx
                ],
            }).compileToV0Message([lookupTableAccount]);
        } else {
            console.log("8");
            messageV0 = new solanaWeb3.TransactionMessage({
                payerKey: provider.publicKey,
                recentBlockhash: (await connection.getRecentBlockhash('confirmed')).blockhash,
                instructions: [
                    // createTempFeeAccountIx,  // HERE
                    // initTempFeeAccountIx,
                    // transferPickleIx,
                    createTempToken1AccountIx,
                    initTempToken1AccountIx,
                    transferToken1Ix,
                    initializeSwapIx
                ],
            }).compileToV0Message([lookupTableAccount]);
        }
    }
    
    const initializeSwapTx = new solanaWeb3.VersionedTransaction(messageV0);
    try {
        let signedTx = await provider.signTransaction(initializeSwapTx);
        signedTx.sign([tempToken1Account, tempToken2Account]);  // HERE
        // signedTx.sign([tempFeeAccount, tempToken1Account, tempToken2Account]);
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

async function SwapTokens() {
    if (!wallet_initialized) {
        console.log("Error, wallet not initialized");
        return
    }
    console.log("Connected to wallet");
    console.log("Provider Pubkey: ", provider.publicKey.toString());

    // These are passed
    let swapInitializer = "2qhQBTHTP1h81GDMj8WmkTuYVMkyxWgYWk2mcytrpnEW"; // phantom hot account
    console.log("swapInitializer ", swapInitializer);

    let tokenSwapProgramId = new solanaWeb3.PublicKey("AAyM7XH9w7ApeSuEat8AwUW1AA7dBuj2vXv7SuUGpNUp");  // HERE

    let programStatePDA = solanaWeb3.PublicKey.findProgramAddressSync(
        [Buffer.from("program-state")],
        tokenSwapProgramId
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

    let pickleMint = null;
    let feeChips = null;
    let devTreasury = null;
    let mcDegensTreasury = null;
    if (programState != null) {
        const encodedProgramStateData = programState.data;
        const decodedProgramStateData = PROGRAM_STATE.decode(
            encodedProgramStateData
        );
        console.log("programState - is_initialized: ", decodedProgramStateData.is_initialized);
        console.log("programState - pickle_mint: ", new solanaWeb3.PublicKey(decodedProgramStateData.pickle_mint).toString());
        console.log("programState - fee_chips: ", new BN(decodedProgramStateData.fee_chips, 10, "le").toString());
        console.log("programState - dev_percentage: ", new BN(decodedProgramStateData.dev_percentage, 10, "le").toString());
        console.log("programState - dev_treasury: ", new solanaWeb3.PublicKey(decodedProgramStateData.dev_treasury).toString());
        console.log("programState - mcdegens_treasury: ", new solanaWeb3.PublicKey(decodedProgramStateData.mcdegens_treasury).toString());

        pickleMint = new solanaWeb3.PublicKey(decodedProgramStateData.pickle_mint);
        feeChips = new BN(decodedProgramStateData.fee_chips, 10, "le");
        devTreasury = new solanaWeb3.PublicKey(decodedProgramStateData.dev_treasury);
        mcDegensTreasury = new solanaWeb3.PublicKey(decodedProgramStateData.mcdegens_treasury);
    } else {
        console.log("Program State Not Initialized");    
        return;
    }

    let swapVaultPDA = solanaWeb3.PublicKey.findProgramAddressSync( 
        [Buffer.from("swap-vault")],
        tokenSwapProgramId
    );
    console.log("Swap Vault PDA: ", swapVaultPDA[0].toString());

    let swapStatePDA = solanaWeb3.PublicKey.findProgramAddressSync(
        [Buffer.from("swap-state"), new solanaWeb3.PublicKey(swapInitializer).toBytes(), provider.publicKey.toBytes()],
        tokenSwapProgramId
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
    let token1Mint = null;
    let token1Amount = null;
    let tempToken1Account = null;
    let token2Mint = null;
    let token2Amount = null;
    let tempToken2Account = null;
    let taker = null
    let token3Mint = null;
    let token3Amount = null;
    let token4Mint = null;
    let token4Amount = null;
    if (swapState != null) {
        const encodedSwapStateData = swapState.data;
        const decodedSwapStateData = SWAP_STATE.decode(
            encodedSwapStateData
        );
        console.log("swapState - is_initialized: ", decodedSwapStateData.is_initialized);
        console.log("swapState - utime", new BN(decodedSwapStateData.utime, 10, "le").toString());  // HERE
        console.log("swapState - initializer: ", new solanaWeb3.PublicKey(decodedSwapStateData.initializer).toString());
        console.log("swapState - token1_mint: ", new solanaWeb3.PublicKey(decodedSwapStateData.token1_mint).toString());
        console.log("swapState - token1_amount", new BN(decodedSwapStateData.token1_amount, 10, "le").toString());
        console.log("swapState - temp_token1_account", new solanaWeb3.PublicKey(decodedSwapStateData.temp_token1_account).toString());
        console.log("swapState - token2_mint: ", new solanaWeb3.PublicKey(decodedSwapStateData.token2_mint).toString());
        console.log("swapState - token2_amount", new BN(decodedSwapStateData.token2_amount, 10, "le").toString());
        console.log("swapState - temp_token2_account", new solanaWeb3.PublicKey(decodedSwapStateData.temp_token2_account).toString());
        console.log("swapState - taker: ", new solanaWeb3.PublicKey(decodedSwapStateData.taker).toString());
        console.log("swapState - token3_mint: ", new solanaWeb3.PublicKey(decodedSwapStateData.token3_mint).toString());
        console.log("swapState - token3_amount", new BN(decodedSwapStateData.token3_amount, 10, "le").toString());
        console.log("swapState - token4_mint: ", new solanaWeb3.PublicKey(decodedSwapStateData.token4_mint).toString());
        console.log("swapState - token4_amount", new BN(decodedSwapStateData.token4_amount, 10, "le").toString());

        initializer = new solanaWeb3.PublicKey(decodedSwapStateData.initializer);
        token1Mint = new solanaWeb3.PublicKey(decodedSwapStateData.token1_mint);
        token1Amount = new BN(decodedSwapStateData.token1_amount, 10, "le");
        tempToken1Account = new solanaWeb3.PublicKey(decodedSwapStateData.temp_token1_account);
        token2Mint = new solanaWeb3.PublicKey(decodedSwapStateData.token2_mint);
        token2Amount = new BN(decodedSwapStateData.token2_amount, 10, "le");
        tempToken2Account = new solanaWeb3.PublicKey(decodedSwapStateData.temp_token2_account);
        taker = new solanaWeb3.PublicKey(decodedSwapStateData.taker);
        token3Mint = new solanaWeb3.PublicKey(decodedSwapStateData.token3_mint);
        token3Amount = new BN(decodedSwapStateData.token3_amount, 10, "le");
        token4Mint = new solanaWeb3.PublicKey(decodedSwapStateData.token4_mint);
        token4Amount = new BN(decodedSwapStateData.token4_amount, 10, "le");
    } else {
        console.log("Swap Not Initialized");    
        return;
    }

    // HERE
    // const tempFeeAccount = new solanaWeb3.Keypair();
    // console.log("Temp Fee Account: ", tempFeeAccount.publicKey.toString());
    // let createTempFeeAccountIx = solanaWeb3.SystemProgram.createAccount({
    //     programId: splToken.TOKEN_PROGRAM_ID,
    //     space: splToken.AccountLayout.span,
    //     lamports: await connection.getMinimumBalanceForRentExemption(
    //         splToken.AccountLayout.span
    //     ),
    //     fromPubkey: provider.publicKey,
    //     newAccountPubkey: tempFeeAccount.publicKey,
    // });    
    // console.log("Create Temp Fee Account Ix: ", createTempFeeAccountIx);    

    // let initTempFeeAccountIx = splToken.createInitializeAccountInstruction(
    //     tempFeeAccount.publicKey,
    //     new solanaWeb3.PublicKey(pickleMint),
    //     tempFeeAccount.publicKey,
    //     splToken.TOKEN_PROGRAM_ID
    // );
    // console.log("Init Temp Fee Account Ix: ", initTempFeeAccountIx);

    let providerPickleATA = await splToken.getAssociatedTokenAddress(
        new solanaWeb3.PublicKey(pickleMint),
        provider.publicKey,
        false,
        splToken.TOKEN_PROGRAM_ID,
        splToken.ASSOCIATED_TOKEN_PROGRAM_ID,
    );    

    // HERE
    // let transferPickleIx = splToken.createTransferInstruction(
    //     providerPickleATA,
    //     tempFeeAccount.publicKey,
    //     provider.publicKey,
    //     feeChips,
    //     provider.publicKey,
    //     splToken.TOKEN_PROGRAM_ID,
    // )
    // console.log("Transfer Pickle Ix: ", transferPickleIx);

    // let createTempToken3AccountIx = null;
    // let initTempToken3AccountIx = null;
    // let transferToken3Ix = null;
    // const tempToken3Account = new solanaWeb3.Keypair();
    // console.log("Temp Token3 Account: ", tempToken3Account.publicKey.toString());
    // if (token3Mint.toString() != "11111111111111111111111111111111") {
    //     createTempToken3AccountIx = solanaWeb3.SystemProgram.createAccount({
    //         programId: splToken.TOKEN_PROGRAM_ID,
    //         space: splToken.AccountLayout.span,
    //         lamports: await connection.getMinimumBalanceForRentExemption(
    //             splToken.AccountLayout.span
    //         ),
    //         fromPubkey: provider.publicKey,
    //         newAccountPubkey: tempToken3Account.publicKey,
    //     });    
    //     console.log("Create Temp Token3 Account Ix: ", createTempToken3AccountIx);    

    //     initTempToken3AccountIx = splToken.createInitializeAccountInstruction(
    //         tempToken3Account.publicKey,
    //         token3Mint,
    //         tempToken3Account.publicKey,
    //         splToken.TOKEN_PROGRAM_ID
    //     );
    //     console.log("Init Temp Token3 Account Ix: ", initTempToken3AccountIx);

    //     let providerToken3ATA = await splToken.getAssociatedTokenAddress(
    //         token3Mint,
    //         provider.publicKey,
    //         false,
    //         splToken.TOKEN_PROGRAM_ID,
    //         splToken.ASSOCIATED_TOKEN_PROGRAM_ID,
    //     );    
    //     transferToken3Ix = splToken.createTransferInstruction(
    //         providerToken3ATA,
    //         tempToken3Account.publicKey,
    //         provider.publicKey,
    //         token3Amount,
    //         provider.publicKey,
    //         splToken.TOKEN_PROGRAM_ID,
    //     )
    //     console.log("Transfer Token3 Ix: ", transferToken3Ix);
    // } else {
    //     createTempToken3AccountIx = solanaWeb3.SystemProgram.createAccount({
    //         programId: tokenSwapProgramId,
    //         space: 0,
    //         lamports: token3Amount,
    //         fromPubkey: provider.publicKey,
    //         newAccountPubkey: tempToken3Account.publicKey,
    //     });    
    //     console.log("Create Token3 Account Tx: ", createTempToken3AccountIx);    
    // }

    // HERE
    let providerToken3ATA = providerPickleATA;
    if (token3Mint.toString() != "11111111111111111111111111111111") {
        providerToken3ATA = await splToken.getAssociatedTokenAddress(
            token3Mint,
            provider.publicKey,
            false,
            splToken.TOKEN_PROGRAM_ID,
            splToken.ASSOCIATED_TOKEN_PROGRAM_ID,
        );
    }

    // HERE
    // let tempToken4Account = new solanaWeb3.Keypair();
    // let createTempToken4AccountIx = null;
    // let initTempToken4AccountIx = null;
    // let transferToken4Ix = null;
    // if (token4Amount > 0) {
    //     console.log("Temp Token4 Account: ", tempToken4Account.publicKey.toString());
    //     createTempToken4AccountIx = solanaWeb3.SystemProgram.createAccount({
    //         programId: splToken.TOKEN_PROGRAM_ID,
    //         space: splToken.AccountLayout.span,
    //         lamports: await connection.getMinimumBalanceForRentExemption(
    //             splToken.AccountLayout.span
    //         ),
    //         fromPubkey: provider.publicKey,
    //         newAccountPubkey: tempToken4Account.publicKey,
    //     });    
    //     console.log("Create Temp Token4 Account Ix: ", createTempToken4AccountIx);    

    //     initTempToken4AccountIx = splToken.createInitializeAccountInstruction(
    //         tempToken4Account.publicKey,
    //         token4Mint,
    //         tempToken4Account.publicKey,
    //         splToken.TOKEN_PROGRAM_ID
    //     );
    //     console.log("Init Temp Token4 Account Ix: ", initTempToken4AccountIx);

    let providerToken4ATA = providerPickleATA;
    if (token4Amount > 0) {
        providerToken4ATA = await splToken.getAssociatedTokenAddress(
            token4Mint,
            provider.publicKey,
            false,
            splToken.TOKEN_PROGRAM_ID,
            splToken.ASSOCIATED_TOKEN_PROGRAM_ID,
        );    
    }
    // HERE
    //     transferToken4Ix = splToken.createTransferInstruction(
    //         providerToken4ATA,
    //         tempToken4Account.publicKey,
    //         provider.publicKey,
    //         token4Amount,
    //         provider.publicKey,
    //         splToken.TOKEN_PROGRAM_ID,
    //     )
    //     console.log("Transfer Token4 Ix: ", transferToken4Ix);
    // }

    let createToken1ATA = null;
    let createToken1ATAIx = null;
    let token1ATA = await splToken.getAssociatedTokenAddress(
        token1Mint,
        provider.publicKey,
        false,
        splToken.TOKEN_PROGRAM_ID,
        splToken.ASSOCIATED_TOKEN_PROGRAM_ID,
    );
    console.log("Token1 ATA: ", token1ATA.toString());

    await connection.getAccountInfo(
        token1ATA
    )
    .then(
        function(response) {
            console.log("token1ATA response ", response);
            if (response == null) {
                createToken1ATA = true;
                createToken1ATAIx = splToken.createAssociatedTokenAccountInstruction(
                    provider.publicKey,
                    token1ATA,
                    provider.publicKey,
                    token1Mint,
                    splToken.TOKEN_PROGRAM_ID,
                    splToken.ASSOCIATED_TOKEN_PROGRAM_ID,
                )
                console.log("Create Token1 ATA Ix: ", createToken1ATAIx);
            } else {
                createToken1ATA = false;
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
    console.log("createToken1ATA ", createToken1ATA);

    let token2ATA = token1ATA;
    let createToken2ATA = null;
    let createToken2ATAIx = null;
    if (token2Amount > 0) {
        token2ATA = await splToken.getAssociatedTokenAddress(
            token2Mint,
            provider.publicKey,
            false,
            splToken.TOKEN_PROGRAM_ID,
            splToken.ASSOCIATED_TOKEN_PROGRAM_ID,
        );
        console.log("Token2 ATA: ", token2ATA.toString());

        await connection.getAccountInfo(
            token2ATA
        )
        .then(
            function(response) {
                console.log("token2ATA response ", response);
                if (response == null) {
                    createToken2ATA = true;
                    createToken2ATAIx = splToken.createAssociatedTokenAccountInstruction(
                        provider.publicKey,
                        token2ATA,
                        provider.publicKey,
                        token2Mint,
                        splToken.TOKEN_PROGRAM_ID,
                        splToken.ASSOCIATED_TOKEN_PROGRAM_ID,
                    )
                    console.log("Create Token2 ATA Ix: ", createToken2ATAIx);
                } else {
                    createToken2ATA = false;
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
        console.log("createToken2ATA ", createToken2ATA);
    }

    let token3ATA = initializer;
    if (token3Mint.toString() != "11111111111111111111111111111111") {
        token3ATA = await splToken.getAssociatedTokenAddress(
            token3Mint,
            initializer,
            false,
            splToken.TOKEN_PROGRAM_ID,
            splToken.ASSOCIATED_TOKEN_PROGRAM_ID,
        );
        console.log("Token3 ATA: ", token3ATA.toString());
    }

    let token4ATA = token3ATA;
    if (token4Amount > 0) {
        token4ATA = await splToken.getAssociatedTokenAddress(
            token4Mint,
            initializer,
            false,
            splToken.TOKEN_PROGRAM_ID,
            splToken.ASSOCIATED_TOKEN_PROGRAM_ID,
        );
        console.log("Token4 ATA: ", token4ATA.toString());
    }

    var totalSize = 1;
    console.log("totalSize", totalSize);

    var uarray = new Uint8Array(totalSize);    
    let counter = 0;    
    uarray[counter++] = 1; // 1 = token_swap SwapNFTs instruction
    console.log("Data: ", uarray);

    const swapTokensIx = new solanaWeb3.TransactionInstruction({
        programId: tokenSwapProgramId,
        data: Buffer.from(
            uarray
        ),
        keys: [
            { pubkey: provider.publicKey, isSigner: true, isWritable: true }, // 0
            { pubkey: initializer, isSigner: false, isWritable: true }, // 1
            { pubkey: programStatePDA[0], isSigner: false, isWritable: false }, // 2
            { pubkey: swapVaultPDA[0], isSigner: false, isWritable: false }, // 3
            { pubkey: swapStatePDA[0], isSigner: false, isWritable: true }, // 4
            { pubkey: tempToken1Account, isSigner: false, isWritable: true }, // 5
            { pubkey: tempToken2Account, isSigner: false, isWritable: true }, // 6
            { pubkey: providerToken3ATA, isSigner: false, isWritable: true }, // 7  HERE
            { pubkey: providerToken4ATA, isSigner: false, isWritable: true }, // 8  HERE
            // { pubkey: tempToken3Account.publicKey, isSigner: false, isWritable: true }, // 7  HERE
            // { pubkey: tempToken4Account.publicKey, isSigner: false, isWritable: true }, // 8  HERE
            { pubkey: token1ATA, isSigner: false, isWritable: true }, // 9
            { pubkey: token2ATA, isSigner: false, isWritable: true }, // 10
            { pubkey: token3ATA, isSigner: false, isWritable: true }, // 11
            { pubkey: token4ATA, isSigner: false, isWritable: true }, // 12
            { pubkey: providerPickleATA, isSigner: false, isWritable: true }, // 13  HERE
            // { pubkey: tempFeeAccount.publicKey, isSigner: true, isWritable: true }, // 13  HERE
            { pubkey: splToken.TOKEN_PROGRAM_ID, isSigner: false, isWritable: false }, // 14
            { pubkey: solanaWeb3.SystemProgram.programId, isSigner: false, isWritable: false }, // 15  HERE
            { pubkey: devTreasury, isSigner: false, isWritable: true }, // 16
            { pubkey: mcDegensTreasury, isSigner: false, isWritable: true }, // 17
        ]
    });
    console.log("Swap Tokens Ix: ", swapTokensIx);

    // let lookupTable = new solanaWeb3.PublicKey("2EruzbDM8KDoiaSQFX9eWzU8ttQnM6PfixCCfjzqmocR"); // devnet
    let lookupTable = new solanaWeb3.PublicKey("DnDkh579fNnBFUwLDeQWgfW6ukLMyt8DgLaVDVwecxmj"); // mainnet    
	const lookupTableAccount = await connection
		.getAddressLookupTable(lookupTable)
		.then((res) => res.value);
    if (!lookupTableAccount) {
        console.log("Could not fetch ALT!");
        return;
    }    

    let messageV0 = null;    
    // HERE  This replaces code commented out below it
    if (createToken1ATA == true && createToken2ATA) {
        console.log("1");
        messageV0 = new solanaWeb3.TransactionMessage({
            payerKey: provider.publicKey,
            recentBlockhash: (await connection.getRecentBlockhash('confirmed')).blockhash,
            instructions: [
                createToken1ATAIx,
                createToken2ATAIx,
                swapTokensIx             
            ],
        }).compileToV0Message([lookupTableAccount]);
    } else if (createToken1ATA) {
        console.log("2");
        messageV0 = new solanaWeb3.TransactionMessage({
            payerKey: provider.publicKey,
            recentBlockhash: (await connection.getRecentBlockhash('confirmed')).blockhash,
            instructions: [
                createToken1ATAIx,
                swapTokensIx             
            ],
        }).compileToV0Message([lookupTableAccount]);
    } else if (createToken2ATA) {
        console.log("3");
        messageV0 = new solanaWeb3.TransactionMessage({
            payerKey: provider.publicKey,
            recentBlockhash: (await connection.getRecentBlockhash('confirmed')).blockhash,
            instructions: [
                createToken2ATAIx,
                swapTokensIx             
            ],
        }).compileToV0Message([lookupTableAccount]);
    } else {
        console.log("4");
        messageV0 = new solanaWeb3.TransactionMessage({
            payerKey: provider.publicKey,
            recentBlockhash: (await connection.getRecentBlockhash('confirmed')).blockhash,
            instructions: [
                swapTokensIx             
            ],
        }).compileToV0Message([lookupTableAccount]);
    }
    // if (token4Amount > 0) {
    //     if (token3Mint.toString() != "11111111111111111111111111111111") {
    //         if (createToken1ATA == true && createToken2ATA) {
    //             console.log("1");
    //             messageV0 = new solanaWeb3.TransactionMessage({
    //                 payerKey: provider.publicKey,
    //                 recentBlockhash: (await connection.getRecentBlockhash('confirmed')).blockhash,
    //                 instructions: [
    //                     createTempFeeAccountIx,
    //                     initTempFeeAccountIx,
    //                     transferPickleIx,
    //                     createTempToken3AccountIx,
    //                     initTempToken3AccountIx,
    //                     transferToken3Ix,
    //                     createTempToken4AccountIx,
    //                     initTempToken4AccountIx,
    //                     transferToken4Ix,            
    //                     createToken1ATAIx,
    //                     createToken2ATAIx,
    //                     swapTokensIx             
    //                 ],
    //             }).compileToV0Message([lookupTableAccount]);
    //         } else if (createToken1ATA) {
    //             console.log("2");
    //             messageV0 = new solanaWeb3.TransactionMessage({
    //                 payerKey: provider.publicKey,
    //                 recentBlockhash: (await connection.getRecentBlockhash('confirmed')).blockhash,
    //                 instructions: [
    //                     createTempFeeAccountIx,
    //                     initTempFeeAccountIx,
    //                     transferPickleIx,
    //                     createTempToken3AccountIx,
    //                     initTempToken3AccountIx,
    //                     transferToken3Ix,
    //                     createTempToken4AccountIx,
    //                     initTempToken4AccountIx,
    //                     transferToken4Ix,            
    //                     createToken1ATAIx,
    //                     swapTokensIx             
    //                 ],
    //             }).compileToV0Message([lookupTableAccount]);
    //         } else if (createToken2ATA) {
    //             console.log("3");
    //             messageV0 = new solanaWeb3.TransactionMessage({
    //                 payerKey: provider.publicKey,
    //                 recentBlockhash: (await connection.getRecentBlockhash('confirmed')).blockhash,
    //                 instructions: [
    //                     createTempFeeAccountIx,
    //                     initTempFeeAccountIx,
    //                     transferPickleIx,
    //                     createTempToken3AccountIx,
    //                     initTempToken3AccountIx,
    //                     transferToken3Ix,
    //                     createTempToken4AccountIx,
    //                     initTempToken4AccountIx,
    //                     transferToken4Ix,            
    //                     createToken2ATAIx,
    //                     swapTokensIx             
    //                 ],
    //             }).compileToV0Message([lookupTableAccount]);
    //         } else {
    //             console.log("4");
    //             messageV0 = new solanaWeb3.TransactionMessage({
    //                 payerKey: provider.publicKey,
    //                 recentBlockhash: (await connection.getRecentBlockhash('confirmed')).blockhash,
    //                 instructions: [
    //                     createTempFeeAccountIx,
    //                     initTempFeeAccountIx,
    //                     transferPickleIx,
    //                     createTempToken3AccountIx,
    //                     initTempToken3AccountIx,
    //                     transferToken3Ix,
    //                     createTempToken4AccountIx,
    //                     initTempToken4AccountIx,
    //                     transferToken4Ix,            
    //                     swapTokensIx             
    //                 ],
    //             }).compileToV0Message([lookupTableAccount]);
    //         }
    //     } else {
    //         if (createToken1ATA == true && createToken2ATA) {
    //             console.log("5");
    //             messageV0 = new solanaWeb3.TransactionMessage({
    //                 payerKey: provider.publicKey,
    //                 recentBlockhash: (await connection.getRecentBlockhash('confirmed')).blockhash,
    //                 instructions: [
    //                     createTempFeeAccountIx,
    //                     initTempFeeAccountIx,
    //                     transferPickleIx,
    //                     createTempToken3AccountIx,
    //                     createTempToken4AccountIx,
    //                     initTempToken4AccountIx,
    //                     transferToken4Ix,            
    //                     createToken1ATAIx,
    //                     createToken2ATAIx,
    //                     swapTokensIx             
    //                 ],
    //             }).compileToV0Message([lookupTableAccount]);
    //         } else if (createToken1ATA) {
    //             console.log("6");
    //             messageV0 = new solanaWeb3.TransactionMessage({
    //                 payerKey: provider.publicKey,
    //                 recentBlockhash: (await connection.getRecentBlockhash('confirmed')).blockhash,
    //                 instructions: [
    //                     createTempFeeAccountIx,
    //                     initTempFeeAccountIx,
    //                     transferPickleIx,
    //                     createTempToken3AccountIx,
    //                     createTempToken4AccountIx,
    //                     initTempToken4AccountIx,
    //                     transferToken4Ix,            
    //                     createToken1ATAIx,
    //                     swapTokensIx             
    //                 ],
    //             }).compileToV0Message([lookupTableAccount]);
    //         } else if (createToken2ATA) {
    //             console.log("7");
    //             messageV0 = new solanaWeb3.TransactionMessage({
    //                 payerKey: provider.publicKey,
    //                 recentBlockhash: (await connection.getRecentBlockhash('confirmed')).blockhash,
    //                 instructions: [
    //                     createTempFeeAccountIx,
    //                     initTempFeeAccountIx,
    //                     transferPickleIx,
    //                     createTempToken3AccountIx,
    //                     createTempToken4AccountIx,
    //                     initTempToken4AccountIx,
    //                     transferToken4Ix,            
    //                     createToken2ATAIx,
    //                     swapTokensIx             
    //                 ],
    //             }).compileToV0Message([lookupTableAccount]);
    //         } else {
    //             console.log("8");
    //             messageV0 = new solanaWeb3.TransactionMessage({
    //                 payerKey: provider.publicKey,
    //                 recentBlockhash: (await connection.getRecentBlockhash('confirmed')).blockhash,
    //                 instructions: [
    //                     createTempFeeAccountIx,
    //                     initTempFeeAccountIx,
    //                     transferPickleIx,
    //                     createTempToken3AccountIx,
    //                     createTempToken4AccountIx,
    //                     initTempToken4AccountIx,
    //                     transferToken4Ix,            
    //                     swapTokensIx             
    //                 ],
    //             }).compileToV0Message([lookupTableAccount]);
    //         }            
    //     }
    // } else {        
    //     if (token3Mint.toString() != "11111111111111111111111111111111") {
    //         if (createToken1ATA == true && createToken2ATA) {
    //             console.log("9");
    //             messageV0 = new solanaWeb3.TransactionMessage({
    //                 payerKey: provider.publicKey,
    //                 recentBlockhash: (await connection.getRecentBlockhash('confirmed')).blockhash,
    //                 instructions: [
    //                     createTempFeeAccountIx,
    //                     initTempFeeAccountIx,
    //                     transferPickleIx,
    //                     createTempToken3AccountIx,
    //                     initTempToken3AccountIx,
    //                     transferToken3Ix,
    //                     createToken1ATAIx,
    //                     createToken2ATAIx,
    //                     swapTokensIx             
    //                 ],
    //             }).compileToV0Message([lookupTableAccount]);
    //         } else if (createToken1ATA) {
    //             console.log("10");
    //             messageV0 = new solanaWeb3.TransactionMessage({
    //                 payerKey: provider.publicKey,
    //                 recentBlockhash: (await connection.getRecentBlockhash('confirmed')).blockhash,
    //                 instructions: [
    //                     createTempFeeAccountIx,
    //                     initTempFeeAccountIx,
    //                     transferPickleIx,
    //                     createTempToken3AccountIx,
    //                     initTempToken3AccountIx,
    //                     transferToken3Ix,
    //                     createToken1ATAIx,
    //                     swapTokensIx             
    //                 ],
    //             }).compileToV0Message([lookupTableAccount]);
    //         } else if (createToken2ATA) {
    //             console.log("11");
    //             messageV0 = new solanaWeb3.TransactionMessage({
    //                 payerKey: provider.publicKey,
    //                 recentBlockhash: (await connection.getRecentBlockhash('confirmed')).blockhash,
    //                 instructions: [
    //                     createTempFeeAccountIx,
    //                     initTempFeeAccountIx,
    //                     transferPickleIx,
    //                     createTempToken3AccountIx,
    //                     initTempToken3AccountIx,
    //                     transferToken3Ix,
    //                     createToken2ATAIx,
    //                     swapTokensIx             
    //                 ],
    //             }).compileToV0Message([lookupTableAccount]);
    //         } else {
    //             console.log("12");
    //             messageV0 = new solanaWeb3.TransactionMessage({
    //                 payerKey: provider.publicKey,
    //                 recentBlockhash: (await connection.getRecentBlockhash('confirmed')).blockhash,
    //                 instructions: [
    //                     createTempFeeAccountIx,
    //                     initTempFeeAccountIx,
    //                     transferPickleIx,
    //                     createTempToken3AccountIx,
    //                     initTempToken3AccountIx,
    //                     transferToken3Ix,
    //                     swapTokensIx             
    //                 ],
    //             }).compileToV0Message([lookupTableAccount]);
    //         }
    //     } else {
    //         if (createToken1ATA == true && createToken2ATA) {
    //             console.log("13");
    //             messageV0 = new solanaWeb3.TransactionMessage({
    //                 payerKey: provider.publicKey,
    //                 recentBlockhash: (await connection.getRecentBlockhash('confirmed')).blockhash,
    //                 instructions: [
    //                     createTempFeeAccountIx,
    //                     initTempFeeAccountIx,
    //                     transferPickleIx,
    //                     createTempToken3AccountIx,
    //                     createToken1ATAIx,
    //                     createToken2ATAIx,
    //                     swapTokensIx             
    //                 ],
    //             }).compileToV0Message([lookupTableAccount]);
    //         } else if (createToken1ATA) {
    //             console.log("14");
    //             messageV0 = new solanaWeb3.TransactionMessage({
    //                 payerKey: provider.publicKey,
    //                 recentBlockhash: (await connection.getRecentBlockhash('confirmed')).blockhash,
    //                 instructions: [
    //                     createTempFeeAccountIx,
    //                     initTempFeeAccountIx,
    //                     transferPickleIx,
    //                     createTempToken3AccountIx,
    //                     createToken1ATAIx,
    //                     swapTokensIx             
    //                 ],
    //             }).compileToV0Message([lookupTableAccount]);
    //         } else if (createToken2ATA) {
    //             console.log("15");
    //             messageV0 = new solanaWeb3.TransactionMessage({
    //                 payerKey: provider.publicKey,
    //                 recentBlockhash: (await connection.getRecentBlockhash('confirmed')).blockhash,
    //                 instructions: [
    //                     createTempFeeAccountIx,
    //                     initTempFeeAccountIx,
    //                     transferPickleIx,
    //                     createTempToken3AccountIx,
    //                     createToken2ATAIx,
    //                     swapTokensIx             
    //                 ],
    //             }).compileToV0Message([lookupTableAccount]);
    //         } else {
    //             console.log("16");
    //             messageV0 = new solanaWeb3.TransactionMessage({
    //                 payerKey: provider.publicKey,
    //                 recentBlockhash: (await connection.getRecentBlockhash('confirmed')).blockhash,
    //                 instructions: [
    //                     createTempFeeAccountIx,
    //                     initTempFeeAccountIx,
    //                     transferPickleIx,
    //                     createTempToken3AccountIx,
    //                     swapTokensIx             
    //                 ],
    //             }).compileToV0Message([lookupTableAccount]);
    //         }            
    //     }
    // }
    console.log("messageV0 ", messageV0);

    const swapTokensTx = new solanaWeb3.VersionedTransaction(messageV0);
    try {
        let signedTx = await provider.signTransaction(swapTokensTx);
        // signedTx.sign([tempFeeAccount, tempToken3Account, tempToken4Account]);  HERE
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
    let taker = "CNcovwf5CbuMHVDofbDVxTtsEAQxmWUgfGeQDS3MnmWH"; // mcswap test account
    console.log("taker ", taker);

    let tokenSwapProgramId = new solanaWeb3.PublicKey("AAyM7XH9w7ApeSuEat8AwUW1AA7dBuj2vXv7SuUGpNUp");  // HERE
    
    let swapVaultPDA = solanaWeb3.PublicKey.findProgramAddressSync(
        [Buffer.from("swap-vault")],
        tokenSwapProgramId
    );
    console.log("Swap Vault PDA: ", swapVaultPDA[0].toString());

    let swapStatePDA = solanaWeb3.PublicKey.findProgramAddressSync(
        [Buffer.from("swap-state"), provider.publicKey.toBytes(), new solanaWeb3.PublicKey(taker).toBytes()],
        tokenSwapProgramId
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

    let token1Mint = null;
    let tempToken1Account = null;
    let token2Mint = null;
    let tempToken2Account = null;
    if (swapState != null) {
        const encodedSwapStateData = swapState.data;
        const decodedSwapStateData = SWAP_STATE.decode(
            encodedSwapStateData
        );
        console.log("swapState - is_initialized: ", decodedSwapStateData.is_initialized);
        console.log("swapState - initializer: ", new solanaWeb3.PublicKey(decodedSwapStateData.initializer).toString());
        console.log("swapState - token1_mint: ", new solanaWeb3.PublicKey(decodedSwapStateData.token1_mint).toString());
        console.log("swapState - token1_amount", new BN(decodedSwapStateData.token1Amount, 10, "le").toString());
        console.log("swapState - temp_token1_account", new solanaWeb3.PublicKey(decodedSwapStateData.temp_token1_account).toString());
        console.log("swapState - token2_mint: ", new solanaWeb3.PublicKey(decodedSwapStateData.token2_mint).toString());
        console.log("swapState - token2_amount", new BN(decodedSwapStateData.token2Amount, 10, "le").toString());
        console.log("swapState - temp_token2_account", new solanaWeb3.PublicKey(decodedSwapStateData.temp_token2_account).toString());

        token1Mint = new solanaWeb3.PublicKey(decodedSwapStateData.token1_mint);
        tempToken1Account = new solanaWeb3.PublicKey(decodedSwapStateData.temp_token1_account);
        token2Mint = new solanaWeb3.PublicKey(decodedSwapStateData.token2_mint);
        tempToken2Account = new solanaWeb3.PublicKey(decodedSwapStateData.temp_token2_account);
    } else {
        console.log("Swap Not Initialized");    
        return;
    }

    let token1ATA = await splToken.getAssociatedTokenAddress(
        token1Mint,
        provider.publicKey,
        false,
        splToken.TOKEN_PROGRAM_ID,
        splToken.ASSOCIATED_TOKEN_PROGRAM_ID,
    );

    let token2ATA = await splToken.getAssociatedTokenAddress(
        token2Mint,
        provider.publicKey,
        false,
        splToken.TOKEN_PROGRAM_ID,
        splToken.ASSOCIATED_TOKEN_PROGRAM_ID,
    );

    var totalSize = 1 + 32;
    console.log("totalSize", totalSize);

    var uarray = new Uint8Array(totalSize);    
    let counter = 0;    
    uarray[counter++] = 2; // 2 = token_swap ReverseSwap instruction

    let takerb58 = bs58.decode(taker);
    var arr = Array.prototype.slice.call(Buffer.from(takerb58), 0);
    for (let i = 0; i < arr.length; i++) {
        uarray[counter++] = arr[i];
    }

    console.log("Data: ", uarray);

    const reverseSwapIx = new solanaWeb3.TransactionInstruction({
        programId: tokenSwapProgramId,
        data: Buffer.from(
            uarray
        ),
        keys: [
            { pubkey: provider.publicKey, isSigner: true, isWritable: true }, // 0
            { pubkey: swapVaultPDA[0], isSigner: false, isWritable: false }, // 1
            { pubkey: swapStatePDA[0], isSigner: false, isWritable: true }, // 2
            { pubkey: tempToken1Account, isSigner: false, isWritable: true }, // 3
            { pubkey: tempToken2Account, isSigner: false, isWritable: true }, // 4
            { pubkey: token1ATA, isSigner: false, isWritable: true }, // 5
            { pubkey: token2ATA, isSigner: false, isWritable: true }, // 6
            { pubkey: splToken.TOKEN_PROGRAM_ID, isSigner: false, isWritable: false }, // 7
        ]
    });
    console.log("Reverse Swap Ix: ", reverseSwapIx);
    
    let messageV0 = new solanaWeb3.TransactionMessage({
        payerKey: provider.publicKey,
        recentBlockhash: (await connection.getRecentBlockhash('confirmed')).blockhash,
        instructions: [reverseSwapIx],
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
    let newPickleMint = "AVm6WLmMuzdedAMjpXLYmSGjLLPPjjVWNuR6JJhJLWn3";
    let newFeeChips = 100000000; // 0
    let newDevPercentage = 50; // 0
    let newDevTreasury = "Hge9B9mdzq3PPy2wu7pSH8gv1qEQFrQtAMf3akMtQ9x3"; // "11111111111111111111111111111111"
    let newMcDegensTreasury = "3xRB4nhyEYW75cPETQqZKRvP9dE9gJ9x2Zb41nkH2L8g";

    let tokenSwapProgramId = new solanaWeb3.PublicKey("AAyM7XH9w7ApeSuEat8AwUW1AA7dBuj2vXv7SuUGpNUp");

    let programStatePDA = solanaWeb3.PublicKey.findProgramAddressSync(
        [Buffer.from("program-state")],
        tokenSwapProgramId
    );
    console.log("Program State PDA: ", programStatePDA[0].toString());

    var totalSize = 1 + 32 + 8 + 1 + 32 + 32;
    console.log("totalSize", totalSize);

    var uarray = new Uint8Array(totalSize);    
    let counter = 0;
    
    uarray[counter++] = 3; // 3 =  token_swap UpdateState instruction

    let newPickleMintb58 = bs58.decode(newPickleMint);
    var arr = Array.prototype.slice.call(Buffer.from(newPickleMintb58), 0);
    for (let i = 0; i < arr.length; i++) {
        uarray[counter++] = arr[i];
    }

    var byteArray = [0, 0, 0, 0, 0, 0, 0, 0];
    for ( var index = 0; index < byteArray.length; index ++ ) {
        var byte = newFeeChips & 0xff;
        byteArray [ index ] = byte;
        newFeeChips = (newFeeChips - byte) / 256 ;
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
    
    const tokenSwapUpdateStateTx = new solanaWeb3.TransactionInstruction({
        programId: tokenSwapProgramId,
        data: Buffer.from(
            uarray
        ),
        keys: [
            { pubkey: provider.publicKey, isSigner: true, isWritable: true }, // 0
            { pubkey: programStatePDA[0], isSigner: false, isWritable: true }, // 1
            { pubkey: solanaWeb3.SystemProgram.programId, isSigner: false, isWritable: false }, // 3
        ],        
    });
    console.log("Token Swap Update State Tx: ", tokenSwapUpdateStateTx);

    let tx = new solanaWeb3.Transaction();
    tx.add(tokenSwapUpdateStateTx);
    tx.recentBlockhash = (await connection.getRecentBlockhash('confirmed')).blockhash;
    tx.feePayer = provider.publicKey;
    console.log("Start Tx")
    try {
        let signedTransaction = await provider.signTransaction(tx);
        console.log("Tx: ", tx);
        const serializedTransaction = signedTransaction.serialize();
        const txId = await connection.sendRawTransaction(
            serializedTransaction,
            { skipPreflight: false, preflightCommitment: 'confirmed' },
        );        
        console.log("Tx ID: ", txId)
        console.log(`https://solscan.io/tx/${txId}?cluster=mainnet`);
    } catch(error) {
        console.log("Error: ", error)
        error = JSON.stringify(error);
        error = JSON.parse(error);
        console.log("Error Logs: ", error)
    }
}

$('#thingButton').on('click', () => {
    console.log('Working ...');
    // InitializeSwap();
    SwapTokens();
    // ReverseSwap();
    // UpdateState();
});
$('#thingButton').prop('disabled', true);

$(window).on('load', async () => {
    await connectRPC();
});