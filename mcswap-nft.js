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

const SWAP_STATE = BufferLayout.struct([
    BufferLayout.u8("is_initialized"),
    BufferLayout.u8("is_swap"),
    publicKey("initializer"),
    publicKey("initializer_mint"),
    publicKey("temp_mint_account"),
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
    let mint = "HmUrp547bFUVpANCRcor9wmCjJu9spKPfCukwMpG9FtG";
    // let swapMint = "4m3hQZh3QXHjUUFjN7UtGACcAQjrRyD9mAMZhCfjwnwy";
    let swapMint = "11111111111111111111111111111111";
    let taker = "DSHrD9pUDhy3y3yeGbr4KGExYdJZrifGWz95RMt9HMJk";
    console.log("mint ", mint);
    console.log("swapMint ", swapMint);
    console.log("taker ", taker);
    let swapLamports = 0;
    //  let swapTokenMint = new solanaWeb3.PublicKey("11111111111111111111111111111111");
    let swapTokenMint = new solanaWeb3.PublicKey("AVm6WLmMuzdedAMjpXLYmSGjLLPPjjVWNuR6JJhJLWn3");
    let swapTokens = 1000000000;

    let isSwap = true;
    if (swapMint == "11111111111111111111111111111111") {
        isSwap = false
    }

    let NFTSwapProgramId = new solanaWeb3.PublicKey("AyJBbGQzUQSvhivZnHMDCCk6eSLupkeBh4fvMAD8T4Xx");
    let feeLamports = 25000000;
    let devTreasury = new solanaWeb3.PublicKey("7aMrZsEeah19YUJ1yVzQSooBYz76qfYi8k24ar2YFWgT");
    let mcDegensTreasury = new solanaWeb3.PublicKey("GUFxwDrsLzSQ27xxTVe4y9BARZ6cENWmjzwe8XPy7AKu");

    let programStatePDA = solanaWeb3.PublicKey.findProgramAddressSync(
        [Buffer.from("program-state")],
        NFTSwapProgramId
    );
    console.log("Program State PDA: ", programStatePDA[0].toString());
    
    let swapVaultPDA = solanaWeb3.PublicKey.findProgramAddressSync(
        [Buffer.from("swap-vault")],
        NFTSwapProgramId
    );
    console.log("Swap Vault PDA: ", swapVaultPDA[0].toString());

    let swapStatePDA = solanaWeb3.PublicKey.findProgramAddressSync(
        [Buffer.from("swap-state"), new solanaWeb3.PublicKey(mint).toBytes(), new solanaWeb3.PublicKey(swapMint).toBytes()],
        NFTSwapProgramId
    );
    console.log("Swap State PDA: ", swapStatePDA[0].toString());

    const tempFeeAccount = new solanaWeb3.Keypair();
    console.log("Temp Fee Account: ", tempFeeAccount.publicKey.toString());
    const createTempFeeAccountIx = solanaWeb3.SystemProgram.createAccount({
        programId: NFTSwapProgramId,
        space: 0,
        lamports: feeLamports,
        fromPubkey: provider.publicKey,
        newAccountPubkey: tempFeeAccount.publicKey,
    });    
    console.log("Create Temp Fee Account Tx: ", createTempFeeAccountIx);

    const tempMintAccount = new solanaWeb3.Keypair();
    console.log("Temp Mint Account: ", tempMintAccount.publicKey.toString());
    let rent = await connection.getMinimumBalanceForRentExemption(splToken.AccountLayout.span)
    let createTempMintAccountIx = solanaWeb3.SystemProgram.createAccount({
        programId: splToken.TOKEN_PROGRAM_ID,
        space: splToken.AccountLayout.span,
        lamports: rent,
        fromPubkey: provider.publicKey,
        newAccountPubkey: tempMintAccount.publicKey,
    });    
    console.log("Create Temp Mint Account Ix: ", createTempMintAccountIx);    

    let initTempMintAccountIx = splToken.createInitializeAccountInstruction(
        tempMintAccount.publicKey,
        new solanaWeb3.PublicKey(mint),
        tempMintAccount.publicKey,
        splToken.TOKEN_PROGRAM_ID
    );
    console.log("Init Temp Mint Account Ix: ", initTempMintAccountIx)

    let providerMintATA = await splToken.getAssociatedTokenAddress(
        new solanaWeb3.PublicKey(mint),
        provider.publicKey,
        false,
        splToken.TOKEN_PROGRAM_ID,
        splToken.ASSOCIATED_TOKEN_PROGRAM_ID,
    );    
    let transferMintIx = splToken.createTransferInstruction(
        providerMintATA,
        tempMintAccount.publicKey,
        provider.publicKey,
        1,
        provider.publicKey,
        splToken.TOKEN_PROGRAM_ID,
    )
    console.log("Transfer Mint Ix: ", transferMintIx);

    let createSwapMintATA = false;
    let swapMintATA = null;
    let createSwapMintATAIx = null;
    if (swapMint != "11111111111111111111111111111111") {
        swapMintATA = await splToken.getAssociatedTokenAddress(
            new solanaWeb3.PublicKey(swapMint),
            provider.publicKey,
            false,
            splToken.TOKEN_PROGRAM_ID,
            splToken.ASSOCIATED_TOKEN_PROGRAM_ID,
        );
        console.log("Swap Mint ATA: ", swapMintATA.toString());
        
        await connection.getAccountInfo(
            swapMintATA
        )
        .then(
            function(response) {
                console.log("swapMintATA response ", response);
                if (response == null) {
                    createSwapMintATA = true;
                    createSwapMintATAIx = splToken.createAssociatedTokenAccountInstruction(
                        provider.publicKey,
                        swapMintATA,
                        provider.publicKey,
                        new solanaWeb3.PublicKey(swapMint),
                        splToken.TOKEN_PROGRAM_ID,
                        splToken.ASSOCIATED_TOKEN_PROGRAM_ID,
                    )
                    console.log("Create Swap Mint ATA Ix: ", createSwapMintATAIx); 
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
            
    var totalSize = 1 + 1 + 32 + 32 + 32 + 8 + 32 + 8;
    console.log("totalSize", totalSize);

    var uarray = new Uint8Array(totalSize);
    let counter = 0;    
    uarray[counter++] = 0; // 0 = nft_swap InitializeSwap instruction

    if (isSwap == true) {
        uarray[counter++] = 1;
    } else {
        uarray[counter++] = 0;
    }
    
    let mintb58 = bs58.decode(mint);
    var arr = Array.prototype.slice.call(Buffer.from(mintb58), 0);
    for (let i = 0; i < arr.length; i++) {
        uarray[counter++] = arr[i];
    }
    
    let takerb58 = bs58.decode(taker);
    var arr = Array.prototype.slice.call(Buffer.from(takerb58), 0);
    for (let i = 0; i < arr.length; i++) {
        uarray[counter++] = arr[i];
    }
        
    let swapMintb58 = bs58.decode(swapMint);
    var arr = Array.prototype.slice.call(Buffer.from(swapMintb58), 0);
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
        programId: NFTSwapProgramId,
        data: Buffer.from(
            uarray
        ),
        keys: [
            { pubkey: provider.publicKey, isSigner: true, isWritable: true }, // 0
            { pubkey: programStatePDA[0], isSigner: false, isWritable: false }, // 1
            { pubkey: swapVaultPDA[0], isSigner: false, isWritable: false }, // 2
            { pubkey: swapStatePDA[0], isSigner: false, isWritable: true }, // 3
            { pubkey: tempFeeAccount.publicKey, isSigner: true, isWritable: true }, // 4
            { pubkey: tempMintAccount.publicKey, isSigner: true, isWritable: true }, // 5
            { pubkey: splToken.TOKEN_PROGRAM_ID, isSigner: false, isWritable: false }, // 6
            { pubkey: devTreasury, isSigner: false, isWritable: true }, // 7
            { pubkey: mcDegensTreasury, isSigner: false, isWritable: true }, // 8
        ]
    });
    console.log("Initialize Swap Ix: ", initializeSwapIx);

    let messageV0 = null;
    if (isSwap == true) {
        if (createSwapMintATA == true && createSwapTokenATA == true) {
            messageV0 = new solanaWeb3.TransactionMessage({
                payerKey: provider.publicKey,
                recentBlockhash: (await connection.getRecentBlockhash('confirmed')).blockhash,
                instructions: [
                    createTempFeeAccountIx, 
                    createTempMintAccountIx, 
                    initTempMintAccountIx, 
                    transferMintIx, 
                    createSwapMintATAIx,
                    createSwapTokenATAIx,
                    initializeSwapIx
                ],
            }).compileToV0Message([]);
        } else if (createSwapMintATA == true) {
            messageV0 = new solanaWeb3.TransactionMessage({
                payerKey: provider.publicKey,
                recentBlockhash: (await connection.getRecentBlockhash('confirmed')).blockhash,
                instructions: [
                    createTempFeeAccountIx, 
                    createTempMintAccountIx, 
                    initTempMintAccountIx, 
                    transferMintIx, 
                    createSwapMintATAIx,
                    initializeSwapIx
                ],
            }).compileToV0Message([]);
        } else if ( createSwapTokenATA == true) {
            messageV0 = new solanaWeb3.TransactionMessage({
                payerKey: provider.publicKey,
                recentBlockhash: (await connection.getRecentBlockhash('confirmed')).blockhash,
                instructions: [
                    createTempFeeAccountIx, 
                    createTempMintAccountIx, 
                    initTempMintAccountIx, 
                    transferMintIx, 
                    createSwapTokenATAIx,
                    initializeSwapIx
                ],
            }).compileToV0Message([]);
        } else {
            messageV0 = new solanaWeb3.TransactionMessage({
                payerKey: provider.publicKey,
                recentBlockhash: (await connection.getRecentBlockhash('confirmed')).blockhash,
                instructions: [
                    createTempFeeAccountIx, 
                    createTempMintAccountIx, 
                    initTempMintAccountIx, 
                    transferMintIx, 
                    initializeSwapIx
                ],
            }).compileToV0Message([]);
        }
    } else {
        if (createSwapTokenATA == true) {
            messageV0 = new solanaWeb3.TransactionMessage({
                payerKey: provider.publicKey,
                recentBlockhash: (await connection.getRecentBlockhash('confirmed')).blockhash,
                instructions: [
                    createTempFeeAccountIx,
                    createTempMintAccountIx, 
                    initTempMintAccountIx, 
                    transferMintIx, 
                    createSwapTokenATAIx,
                    initializeSwapIx
                ],
            }).compileToV0Message([]);
        } else {
            messageV0 = new solanaWeb3.TransactionMessage({
                payerKey: provider.publicKey,
                recentBlockhash: (await connection.getRecentBlockhash('confirmed')).blockhash,
                instructions: [
                    createTempFeeAccountIx,
                    createTempMintAccountIx, 
                    initTempMintAccountIx, 
                    transferMintIx, 
                    initializeSwapIx
                ],
            }).compileToV0Message([]);
        }
    }

    const initializeSwapTx = new solanaWeb3.VersionedTransaction(messageV0);
    try {
        let signedTx = await provider.signTransaction(initializeSwapTx);
        signedTx.sign([tempFeeAccount, tempMintAccount]);
        const txId = await connection.sendTransaction(signedTx);
        console.log("Signature: ", txId)
        console.log(`https://solscan.io/tx/${txId}?cluster=devnet`);
    } catch(error) {
        console.log("Error: ", error)
        error = JSON.stringify(error);
        error = JSON.parse(error);
        console.log("Error Logs: ", error)
        return;
    }
}

async function SwapNFTs() {
    if (!wallet_initialized) {
        console.log("Error, wallet not initialized");
        return
    }
    console.log("Connected to wallet");
    console.log("Provider Pubkey: ", provider.publicKey.toString());

    // These are passed
    let mint = "jiwjFjXN2B9A5mvwVTkh2Fw6RK7bBb3sDCNPS59t8XB";
    // let swapMint = "4m3hQZh3QXHjUUFjN7UtGACcAQjrRyD9mAMZhCfjwnwy";
    let swapMint = "11111111111111111111111111111111";
    console.log("mint ", mint);
    console.log("swapMint ", swapMint);

    let NFTSwapProgramId = new solanaWeb3.PublicKey("AyJBbGQzUQSvhivZnHMDCCk6eSLupkeBh4fvMAD8T4Xx");
    let feeLamports = 25000000;
    let devTreasury = new solanaWeb3.PublicKey("7aMrZsEeah19YUJ1yVzQSooBYz76qfYi8k24ar2YFWgT");
    let mcDegensTreasury = new solanaWeb3.PublicKey("GUFxwDrsLzSQ27xxTVe4y9BARZ6cENWmjzwe8XPy7AKu");

    let programStatePDA = solanaWeb3.PublicKey.findProgramAddressSync(
        [Buffer.from("program-state")],
        NFTSwapProgramId
    );
    console.log("Program State PDA: ", programStatePDA[0].toString());

    let swapVaultPDA = solanaWeb3.PublicKey.findProgramAddressSync( 
        [Buffer.from("swap-vault")],
        NFTSwapProgramId
    );
    console.log("Swap Vault PDA: ", swapVaultPDA[0].toString());

    let swapStatePDA = solanaWeb3.PublicKey.findProgramAddressSync(
        [Buffer.from("swap-state"), new solanaWeb3.PublicKey(mint).toBytes(), new solanaWeb3.PublicKey(swapMint).toBytes()],
        NFTSwapProgramId
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

    let isSwap = true;
    let initializer = null;
    let tempMintAccount = null;
    let initializer_mint = null;
    let swapLamports = null;
    let swapTokenMint = null;
    let swapTokens = null;
    if (swapState != null) {
        const encodedSwapStateData = swapState.data;
        const decodedSwapStateData = SWAP_STATE.decode(
            encodedSwapStateData
        );
        console.log("swapState - is_initialized: ", decodedSwapStateData.is_initialized);
        console.log("swapState - is_swap: ", new BN(decodedSwapStateData.is_swap, 10, "le").toString());
        console.log("swapState - initializer: ", new solanaWeb3.PublicKey(decodedSwapStateData.initializer).toString());
        console.log("swapState - initializer_mint: ", new solanaWeb3.PublicKey(decodedSwapStateData.initializer_mint).toString());
        console.log("swapState - temp_mint_account: ", new solanaWeb3.PublicKey(decodedSwapStateData.temp_mint_account).toString());
        console.log("swapState - taker: ", new solanaWeb3.PublicKey(decodedSwapStateData.taker).toString());
        console.log("swapState - swap_mint: ", new solanaWeb3.PublicKey(decodedSwapStateData.swap_mint).toString());
        console.log("swapState - swap_lamports", new BN(decodedSwapStateData.swap_lamports, 10, "le").toString());
        console.log("swapState - swap_token_mint", new solanaWeb3.PublicKey(decodedSwapStateData.swap_token_mint).toString());
        console.log("swapState - swap_tokens", new BN(decodedSwapStateData.swap_tokens, 10, "le").toString());

        if (new BN(decodedSwapStateData.is_swap, 10, "le") == 0) {
            isSwap = false
        }
        initializer = new solanaWeb3.PublicKey(decodedSwapStateData.initializer);
        initializer_mint = new solanaWeb3.PublicKey(decodedSwapStateData.initializer_mint);
        tempMintAccount = new solanaWeb3.PublicKey(decodedSwapStateData.temp_mint_account);
        swapLamports = new BN(decodedSwapStateData.swap_lamports, 10, "le");
        swapTokenMint = new solanaWeb3.PublicKey(decodedSwapStateData.swap_token_mint);
        swapTokens = new BN(decodedSwapStateData.swap_tokens, 10, "le");
    } else {
        console.log("Swap Not Initialized");    
        return;
    }

    let createInitializerMintATA = null;
    let createInitializerMintATAIx = null;
    let initializerMintATA = await splToken.getAssociatedTokenAddress(
        initializer_mint,
        provider.publicKey,
        false,
        splToken.TOKEN_PROGRAM_ID,
        splToken.ASSOCIATED_TOKEN_PROGRAM_ID,
    );
    console.log("Initializer Mint ATA: ", initializerMintATA.toString());

    await connection.getAccountInfo(
        initializerMintATA
    )
    .then(
        function(response) {
            console.log("initializerMintATA response ", response);
            if (response == null) {
                createInitializerMintATA = true;
                createInitializerMintATAIx = splToken.createAssociatedTokenAccountInstruction(
                    provider.publicKey,
                    initializerMintATA,
                    provider.publicKey,
                    initializer_mint,
                    splToken.TOKEN_PROGRAM_ID,
                    splToken.ASSOCIATED_TOKEN_PROGRAM_ID,
                )
                console.log("Create Initializer Mint ATA Ix: ", createInitializerMintATAIx);
            } else {
                createInitializerMintATA = false;
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
    console.log("createInitializerMintATA ", createInitializerMintATA);

    const tempSwapMintAccount = new solanaWeb3.Keypair();
    console.log("Temp Swap Mint Account: ", tempSwapMintAccount.publicKey.toString());
    let createTempSwapMintAccount = false;
    let createTempSwapMintAccountIx = null;
    let initTempSwapMintAccountIx = null;    
    let transferSwapMintIx = null;
    let swapMintATA = new solanaWeb3.PublicKey("11111111111111111111111111111111");
    if (swapMint != "11111111111111111111111111111111") {
        let rent = await connection.getMinimumBalanceForRentExemption(splToken.AccountLayout.span);
        createTempSwapMintAccount = true;
        createTempSwapMintAccountIx = solanaWeb3.SystemProgram.createAccount({
            programId: splToken.TOKEN_PROGRAM_ID,
            space: splToken.AccountLayout.span,
            lamports: rent,
            fromPubkey: provider.publicKey,
            newAccountPubkey: tempSwapMintAccount.publicKey,
        });    
        console.log("Create Temp Swap Mint Account Ix: ", createTempSwapMintAccountIx);    

        initTempSwapMintAccountIx = splToken.createInitializeAccountInstruction(
            tempSwapMintAccount.publicKey,
            new solanaWeb3.PublicKey(swapMint),
            tempSwapMintAccount.publicKey,
            splToken.TOKEN_PROGRAM_ID
        );
        console.log("Init Temp Swap Mint Account Ix: ", initTempSwapMintAccountIx)

        let providerSwapMintATA = await splToken.getAssociatedTokenAddress(
            new solanaWeb3.PublicKey(swapMint),
            provider.publicKey,
            false,
            splToken.TOKEN_PROGRAM_ID,
            splToken.ASSOCIATED_TOKEN_PROGRAM_ID,
        );    
        transferSwapMintIx = splToken.createTransferInstruction(
            providerSwapMintATA,
            tempSwapMintAccount.publicKey,
            provider.publicKey,
            1,
            provider.publicKey,
            splToken.TOKEN_PROGRAM_ID,
        )
        console.log("Transfer Swap Mint Ix: ", transferSwapMintIx);
        
        swapMintATA = await splToken.getAssociatedTokenAddress(
            new solanaWeb3.PublicKey(swapMint),
            initializer,
            false,
            splToken.TOKEN_PROGRAM_ID,
            splToken.ASSOCIATED_TOKEN_PROGRAM_ID,
        );
        console.log("Swap Mint ATA: ", swapMintATA.toString()); 
    }   
    
    const totalFee = parseInt(feeLamports) + parseInt(swapLamports);
    console.log("totalFee ", totalFee);
    const tempFeeAccount = new solanaWeb3.Keypair();
    console.log("Temp Fee Account: ", tempFeeAccount.publicKey.toString());
    const createTempFeeAccountIx = solanaWeb3.SystemProgram.createAccount({
        programId: NFTSwapProgramId,
        space: 0,
        lamports: totalFee,
        fromPubkey: provider.publicKey,
        newAccountPubkey: tempFeeAccount.publicKey,
    });    
    console.log("Create Temp Fee Account Tx: ", createTempFeeAccountIx);

    const providerTokenATA = await splToken.getAssociatedTokenAddress(
        swapTokenMint,
        provider.publicKey,
        false,
        splToken.TOKEN_PROGRAM_ID,
        splToken.ASSOCIATED_TOKEN_PROGRAM_ID,
    );
    console.log("Provider Token ATA: ", providerTokenATA.toString());

    const tempTokenAccount = new solanaWeb3.Keypair();
    console.log("Temp Token Account: ", tempTokenAccount.publicKey.toString());
    let createTempTokenAccount = false;
    let createTempTokenAccountIx = null;
    let initTempTokenAccountIx = null;
    let transferTokenIx = null;
    if (swapTokens > 0) {
        let rent = await connection.getMinimumBalanceForRentExemption(splToken.AccountLayout.span);
        createTempTokenAccount = true;
        createTempTokenAccountIx = solanaWeb3.SystemProgram.createAccount({
            programId: splToken.TOKEN_PROGRAM_ID,
            space: splToken.AccountLayout.span,
            lamports: rent,
            fromPubkey: provider.publicKey,
            newAccountPubkey: tempTokenAccount.publicKey,
        });    
        console.log("Create Temp Token Account Ix: ", createTempTokenAccountIx);    

        initTempTokenAccountIx = splToken.createInitializeAccountInstruction(
            tempTokenAccount.publicKey,
            swapTokenMint,
            tempTokenAccount.publicKey,
            splToken.TOKEN_PROGRAM_ID
        );
        console.log("Init Temp Token Account Ix: ", initTempTokenAccountIx)

        transferTokenIx = splToken.createTransferInstruction(
            providerTokenATA,
            tempTokenAccount.publicKey,
            provider.publicKey,
            parseInt(swapTokens),
            provider.publicKey,
            splToken.TOKEN_PROGRAM_ID,
        )
        console.log("Transfer Token Ix: ", transferTokenIx);
    }

    const initializerTokenATA = await splToken.getAssociatedTokenAddress(
        swapTokenMint,
        initializer,
        false,
        splToken.TOKEN_PROGRAM_ID,
        splToken.ASSOCIATED_TOKEN_PROGRAM_ID,
    );
    console.log("Initializer Token ATA: ", initializerTokenATA.toString());

    var totalSize = 1;
    console.log("totalSize", totalSize);

    var uarray = new Uint8Array(totalSize);    
    let counter = 0;    
    uarray[counter++] = 1; // 1 = nft_swap SwapNFTs instruction
    console.log("Data: ", uarray);

    const swapNFTsIx = new solanaWeb3.TransactionInstruction({
        programId: NFTSwapProgramId,
        data: Buffer.from(
            uarray
        ),
        keys: [
            { pubkey: provider.publicKey, isSigner: true, isWritable: true }, // 0
            { pubkey: initializer, isSigner: false, isWritable: true }, // 1
            { pubkey: programStatePDA[0], isSigner: false, isWritable: false }, // 2
            { pubkey: swapVaultPDA[0], isSigner: false, isWritable: false }, // 3
            { pubkey: swapStatePDA[0], isSigner: false, isWritable: true }, // 4
            { pubkey: tempMintAccount, isSigner: false, isWritable: true }, // 5
            { pubkey: initializerMintATA, isSigner: false, isWritable: true }, // 6
            { pubkey: tempSwapMintAccount.publicKey, isSigner: true, isWritable: true }, // 7
            { pubkey: swapMintATA, isSigner: false, isWritable: true }, // 8
            { pubkey: splToken.TOKEN_PROGRAM_ID, isSigner: false, isWritable: false }, // 9
            { pubkey: tempFeeAccount.publicKey, isSigner: true, isWritable: true }, // 10
            { pubkey: tempTokenAccount.publicKey, isSigner: true, isWritable: true }, // 11
            { pubkey: initializerTokenATA, isSigner: false, isWritable: true }, // 12
            { pubkey: devTreasury, isSigner: false, isWritable: true }, // 13
            { pubkey: mcDegensTreasury, isSigner: false, isWritable: true }, // 14
        ]
    });
    console.log("Swap NFTs Ix: ", swapNFTsIx);

    let lookupTable = new solanaWeb3.PublicKey("237E435fmEtgciZFYNMcdEBcELFd1GAhxfh17gmPE7JR"); // devnet
    // let lookupTable = new solanaWeb3.PublicKey("BT4AUPXSxvbDrzSt3LLkE3Jd5s8R3fBSxJuyicyEMYH3"); // mainnet    
	const lookupTableAccount = await connection
		.getAddressLookupTable(lookupTable)
		.then((res) => res.value);
    if (!lookupTableAccount) {
        console.log("Could not fetch ALT!");
        return;
    }    

    let messageV0 = null;
    if (isSwap == true) {
        if (createInitializerMintATA == true && createTempTokenAccount == true) {        
            console.log("1");
            messageV0 = new solanaWeb3.TransactionMessage({
                payerKey: provider.publicKey,
                recentBlockhash: (await connection.getRecentBlockhash('confirmed')).blockhash,
                instructions: [
                    createInitializerMintATAIx,
                    createTempSwapMintAccountIx,
                    initTempSwapMintAccountIx,
                    transferSwapMintIx,
                    createTempFeeAccountIx,
                    createTempTokenAccountIx,
                    initTempTokenAccountIx,
                    transferTokenIx,
                    swapNFTsIx,
                ],
            }).compileToV0Message([lookupTableAccount]);
        } else if (createInitializerMintATA == true) {
            console.log("2");
            messageV0 = new solanaWeb3.TransactionMessage({
                payerKey: provider.publicKey,
                recentBlockhash: (await connection.getRecentBlockhash('confirmed')).blockhash,
                instructions: [
                    createInitializerMintATAIx,
                    createTempSwapMintAccountIx,
                    initTempSwapMintAccountIx,
                    transferSwapMintIx,
                    createTempFeeAccountIx,
                    swapNFTsIx,
                ],
            }).compileToV0Message([lookupTableAccount]);
        } else if (createTempTokenAccount == true) {
            console.log("3");
            messageV0 = new solanaWeb3.TransactionMessage({
                payerKey: provider.publicKey,
                recentBlockhash: (await connection.getRecentBlockhash('confirmed')).blockhash,
                instructions: [
                    createTempSwapMintAccountIx,
                    initTempSwapMintAccountIx,
                    transferSwapMintIx,
                    createTempFeeAccountIx,
                    createTempTokenAccountIx,
                    initTempTokenAccountIx,
                    transferTokenIx,
                    swapNFTsIx,
                ],
            }).compileToV0Message([lookupTableAccount]);
        } else {
            console.log("4");
            messageV0 = new solanaWeb3.TransactionMessage({
                payerKey: provider.publicKey,
                recentBlockhash: (await connection.getRecentBlockhash('confirmed')).blockhash,
                instructions: [
                    createTempSwapMintAccountIx,
                    initTempSwapMintAccountIx,
                    transferSwapMintIx,
                    createTempFeeAccountIx,
                    swapNFTsIx,
                ],
            }).compileToV0Message([lookupTableAccount]);
        }
    } else {
        if (createInitializerMintATA == true && createTempTokenAccount == true) {
            console.log("5");    
            messageV0 = new solanaWeb3.TransactionMessage({
                payerKey: provider.publicKey,
                recentBlockhash: (await connection.getRecentBlockhash('confirmed')).blockhash,
                instructions: [
                    createInitializerMintATAIx,
                    createTempFeeAccountIx,
                    createTempTokenAccountIx,
                    initTempTokenAccountIx,
                    transferTokenIx,
                    swapNFTsIx,
                ],
            }).compileToV0Message([lookupTableAccount]);
        } else if (createInitializerMintATA == true) {
            console.log("6");
            messageV0 = new solanaWeb3.TransactionMessage({
                payerKey: provider.publicKey,
                recentBlockhash: (await connection.getRecentBlockhash('confirmed')).blockhash,
                instructions: [
                    createInitializerMintATAIx,
                    createTempFeeAccountIx,
                    swapNFTsIx,
                ],
            }).compileToV0Message([lookupTableAccount]);
        } else if (createTempTokenAccount == true) {
            console.log("7");
            messageV0 = new solanaWeb3.TransactionMessage({
                payerKey: provider.publicKey,
                recentBlockhash: (await connection.getRecentBlockhash('confirmed')).blockhash,
                instructions: [
                    createTempFeeAccountIx,
                    createTempTokenAccountIx,
                    initTempTokenAccountIx,
                    transferTokenIx,
                    swapNFTsIx,
                ],
            }).compileToV0Message([lookupTableAccount]);
        } else {
            console.log("8");
            messageV0 = new solanaWeb3.TransactionMessage({
                payerKey: provider.publicKey,
                recentBlockhash: (await connection.getRecentBlockhash('confirmed')).blockhash,
                instructions: [
                    createTempFeeAccountIx,
                    swapNFTsIx,
                ],
            }).compileToV0Message([lookupTableAccount]);
        }
    }
    console.log("messageV0 ", messageV0);

    const swapNFTSTx = new solanaWeb3.VersionedTransaction(messageV0);
    try {
        let signedTx = await provider.signTransaction(swapNFTSTx);
        signedTx.sign([tempSwapMintAccount, tempFeeAccount, tempTokenAccount]);
        const txId = await connection.sendTransaction(signedTx);
        console.log("Signature: ", txId)
        console.log(`https://solscan.io/tx/${txId}?cluster=devnet`);
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
    let mint = "jiwjFjXN2B9A5mvwVTkh2Fw6RK7bBb3sDCNPS59t8XB";
    // let swapMint = "4m3hQZh3QXHjUUFjN7UtGACcAQjrRyD9mAMZhCfjwnwy";
    let swapMint = "11111111111111111111111111111111";

    let NFTSwapProgramId = new solanaWeb3.PublicKey("AyJBbGQzUQSvhivZnHMDCCk6eSLupkeBh4fvMAD8T4Xx");
    
    let swapVaultPDA = solanaWeb3.PublicKey.findProgramAddressSync(
        [Buffer.from("swap-vault")],
        NFTSwapProgramId
    );
    console.log("Swap Vault PDA: ", swapVaultPDA[0].toString());

    let swapStatePDA = solanaWeb3.PublicKey.findProgramAddressSync(
        [Buffer.from("swap-state"), new solanaWeb3.PublicKey(mint).toBytes(), new solanaWeb3.PublicKey(swapMint).toBytes()],
        NFTSwapProgramId
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

    let tempMintAccount = null;
    if (swapState != null) {
        const encodedSwapStateData = swapState.data;
        const decodedSwapStateData = SWAP_STATE.decode(
            encodedSwapStateData
        );
        console.log("swapState - is_initialized: ", decodedSwapStateData.is_initialized);

        console.log("swapState - initializer: ", new solanaWeb3.PublicKey(decodedSwapStateData.initializer).toString());
        console.log("swapState - initializer_mint: ", new solanaWeb3.PublicKey(decodedSwapStateData.initializer_mint).toString());
        console.log("swapState - temp_mint_account: ", new solanaWeb3.PublicKey(decodedSwapStateData.temp_mint_account).toString());
        console.log("swapState - swap_mint: ", new solanaWeb3.PublicKey(decodedSwapStateData.swap_mint).toString());
        console.log("swapState - swap_lamports", new BN(decodedSwapStateData.swap_lamports, 10, "le").toString());
        console.log("swapState - swap_token_mint", new solanaWeb3.PublicKey(decodedSwapStateData.swap_token_mint).toString());
        console.log("swapState - swap_tokens", new BN(decodedSwapStateData.swap_tokens, 10, "le").toString());

        tempMintAccount = new solanaWeb3.PublicKey(decodedSwapStateData.temp_mint_account);
    } else {
        console.log("Swap Not Initialized");    
        return;
    }

    let initializerMintATA = await splToken.getAssociatedTokenAddress(
        new solanaWeb3.PublicKey(mint),
        provider.publicKey,
        false,
        splToken.TOKEN_PROGRAM_ID,
        splToken.ASSOCIATED_TOKEN_PROGRAM_ID,
    );

    var totalSize = 1;
    console.log("totalSize", totalSize);

    var uarray = new Uint8Array(totalSize);    
    let counter = 0;    
    uarray[counter++] = 2; // 2 = nft_swap ReverseSwap instruction
    console.log("Data: ", uarray);

    const reverseSwapIx = new solanaWeb3.TransactionInstruction({
        programId: NFTSwapProgramId,
        data: Buffer.from(
            uarray
        ),
        keys: [
            { pubkey: provider.publicKey, isSigner: true, isWritable: true }, // 0
            { pubkey: swapVaultPDA[0], isSigner: false, isWritable: false }, // 1
            { pubkey: swapStatePDA[0], isSigner: false, isWritable: true }, // 2
            { pubkey: tempMintAccount, isSigner: false, isWritable: true }, // 3
            { pubkey: initializerMintATA, isSigner: false, isWritable: true }, // 4
            { pubkey: splToken.TOKEN_PROGRAM_ID, isSigner: false, isWritable: false }, // 5
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
        console.log(`https://solscan.io/tx/${txId}?cluster=devnet`);
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
    let newDevTreasury = "7aMrZsEeah19YUJ1yVzQSooBYz76qfYi8k24ar2YFWgT"; // "11111111111111111111111111111111"
    let newMcDegensTreasury = "GUFxwDrsLzSQ27xxTVe4y9BARZ6cENWmjzwe8XPy7AKu";

    let NFTSwapProgramId = new solanaWeb3.PublicKey("AyJBbGQzUQSvhivZnHMDCCk6eSLupkeBh4fvMAD8T4Xx");

    let cNFTProgramStatePDA = solanaWeb3.PublicKey.findProgramAddressSync(
        [Buffer.from("program-state")],
        NFTSwapProgramId
    );
    console.log("Program State PDA: ", cNFTProgramStatePDA[0].toString());

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
    
    const NFTSwapUpdateStateTx = new solanaWeb3.TransactionInstruction({
        programId: NFTSwapProgramId,
        data: Buffer.from(
            uarray
        ),
        keys: [
            { pubkey: provider.publicKey, isSigner: true, isWritable: true }, // 0
            { pubkey: cNFTProgramStatePDA[0], isSigner: false, isWritable: true }, // 1
            { pubkey: solanaWeb3.SystemProgram.programId, isSigner: false, isWritable: false }, // 3
        ],        
    });
    console.log("NFT Swap Update State Tx: ", NFTSwapUpdateStateTx);

    let tx = new solanaWeb3.Transaction();
    tx.add(NFTSwapUpdateStateTx);
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

$('#thingButton').on('click', () => {
    console.log('Working ...');
    InitializeSwap();
    // SwapNFTs();
    // ReverseSwap();
    // UpdateState();
});
$('#thingButton').prop('disabled', true);

$(window).on('load', async () => {
    await connectRPC();
});