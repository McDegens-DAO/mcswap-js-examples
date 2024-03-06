import axios from "axios";
import * as mplBubblegum from "@metaplex-foundation/mpl-bubblegum";
import * as solanaWeb3 from "@solana/web3.js";
import * as solanaAccountCompression from "@solana/spl-account-compression";
import * as splToken from "@solana/spl-token";
import * as bs58 from "bs58";
import $ from 'jquery';
import BN from "bn.js";
import * as buffer from "buffer";
window.Buffer = buffer.Buffer;
import * as BufferLayout from 'buffer-layout';
import { is } from "superstruct";

const publicKey = (property = "publicKey") => {
    return BufferLayout.blob(32, property);
};  
const uint64 = (property = "uint64") => {
    return BufferLayout.blob(8, property);
};

// HERE
const PROGRAM_STATE = BufferLayout.struct([
    BufferLayout.u8("is_initialized"),
    uint64("fee_lamports"),
    BufferLayout.u8("dev_percentage"),
    publicKey("dev_treasury"),
    publicKey("mcdegens_treasury"),
]);

const SWAP_STATE = BufferLayout.struct([
    BufferLayout.u8("is_initialized"),
    uint64("utime"),  // HERE
    BufferLayout.u8("is_swap"), 
    publicKey("initializer"),
    publicKey("delegate"),  // HERE
    publicKey("asset_id"),
    publicKey("merkle_tree"),
    publicKey("root"),
    publicKey("data_hash"),
    publicKey("creator_hash"),
    uint64("nonce"),
    publicKey("swap_asset_id"),
    publicKey("swap_merkle_tree"),
    publicKey("swap_root"),
    publicKey("swap_data_hash"),
    publicKey("swap_creator_hash"),
    uint64("swap_nonce"),
    publicKey("swap_leaf_owner"),
    publicKey("swap_delegate"),  // HERE
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
        "https://rpc.helius.xyz/?api-key=HELIUS_KEY",
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
    
    // these are passed
    let assetId = "8rbKH6o4dNGqGJA8NLTFyityY1rTKTekwEMNpRXn9TBK";  // 148
    // let swapAssetId = "11111111111111111111111111111111";  // This should be the value of swapAssetId if NOT swapping
    let swapAssetId = "64XvySfcEUxs9giDuk2agLNJQwEyuZQ2EgY3yeMvcA74";
    let taker = "CNcovwf5CbuMHVDofbDVxTtsEAQxmWUgfGeQDS3MnmWH";     
    let swapLamports = 1000;
    
    // let swapTokenMint = new solanaWeb3.PublicKey("11111111111111111111111111111111"); // This should be the value of swapTokenMint if swapTokens == 0
    let swapTokenMint = new solanaWeb3.PublicKey("AVm6WLmMuzdedAMjpXLYmSGjLLPPjjVWNuR6JJhJLWn3");
    let swapTokens = 100000000;
    
    console.log("assetId ", assetId);
    console.log("swapAssetId ", swapAssetId);
    console.log("swapLamports ", swapLamports);
    console.log("swapTokenMint ", swapTokenMint);
    console.log("swapTokens ", swapTokens);
    
    let isSwap = true;
    if (swapAssetId == "11111111111111111111111111111111") {
        isSwap = false
    }

    let heliusUrl = "https://rpc.helius.xyz/?api-key=HELIUS_KEY";

    // let cNFTSwapProgramId = new solanaWeb3.PublicKey("ABDXeLg3NiQKf7xRyEjZ3HTCTP1dWezCAjVmxJ8NdWz1"); // v0
    // let cNFTSwapProgramId = new solanaWeb3.PublicKey("8Tg1SpWz9JNr5praJssiALNs3G6GQU5qvuoxf85aRh74"); // v1
    let cNFTSwapProgramId = new solanaWeb3.PublicKey("6RUcK9T1hYAZGBxN82ERVDUi4vLAX4hN1zAyy3cU5jav"); // v2  HERE

    // HERE  now reading the following 3 vars from program state
    // let devTreasury = new solanaWeb3.PublicKey("2Gs1H87sQDmHS91iXaVQnhdWTGzsgo2vypAwdDRJTLqX");
    // let mcDegensTreasury = new solanaWeb3.PublicKey("GUFxwDrsLzSQ27xxTVe4y9BARZ6cENWmjzwe8XPy7AKu");
    // let feeLamports = 25_000_000;
    let programStatePDA = solanaWeb3.PublicKey.findProgramAddressSync(
        [Buffer.from("cNFT-program-state")],
        cNFTSwapProgramId
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

    const axiosInstance = axios.create({
        baseURL: heliusUrl,
    });

    const getAsset = await axiosInstance.post(heliusUrl, {
        jsonrpc: "2.0",
        method: "getAsset",
        id: "rpd-op-123",
        params: {
            id: assetId
        },
    });
    console.log("getAsset ", getAsset);
    console.log("data_hash ", getAsset.data.result.compression.data_hash);
    console.log("creator_hash ", getAsset.data.result.compression.creator_hash);
    console.log("leaf_id ", getAsset.data.result.compression.leaf_id);
    // HERE 
    let delegate = provider.publicKey;
    if (getAsset.data.result.ownership.delegated == true) {
        console.log("1");
        delegate = new solanaWeb3.PublicKey(getAsset.data.result.ownership.delegate);
    }
    console.log("delegate ", delegate.toString());

    if (getAsset.data.result.ownership.owner != provider.publicKey) {
        console.log("Asset Not owned by provider");
        return;
    }

    const getAssetProof = await axiosInstance.post(heliusUrl, {
        jsonrpc: "2.0",
        method: "getAssetProof",
        id: "rpd-op-123",
        params: {
            id: assetId
        },
    });
    console.log("getAssetProof ", getAssetProof);
    console.log("tree_id ", getAssetProof.data.result.tree_id);
    console.log("proof ", getAssetProof.data.result.proof);
    console.log("root ", getAssetProof.data.result.root);

    const treeAccount = await solanaAccountCompression.ConcurrentMerkleTreeAccount.fromAccountAddress(
        connection,
        new solanaWeb3.PublicKey(getAssetProof.data.result.tree_id),
    );  
    const treeAuthorityPDA = treeAccount.getAuthority();
    const canopyDepth = treeAccount.getCanopyDepth();
    console.log("treeAuthorityPDA ", treeAuthorityPDA.toString());
    console.log("canopyDepth ", canopyDepth);

    // parse the list of proof addresses into a valid AccountMeta[]
    const proof = getAssetProof.data.result.proof
        .slice(0, getAssetProof.data.result.proof.length - (!!canopyDepth ? canopyDepth : 0))
        .map((node) => ({
            pubkey: new solanaWeb3.PublicKey(node),
            isWritable: false,
            isSigner: false,
        }));
    console.log("proof ", proof);
    
    let swapAssetOwner = taker;
    let swapDelegate = taker;
    let swapDatahash = "11111111111111111111111111111111";
    let swapCreatorhash = "11111111111111111111111111111111";
    let swapLeafId = 0;
    let swapTreeId  = "11111111111111111111111111111111";
    let swapRoot  = "11111111111111111111111111111111";
    let swapProof = null;
    if (isSwap == true) {
        let getSwapAsset = await axiosInstance.post(heliusUrl, {
            jsonrpc: "2.0",
            method: "getAsset",
            id: "rpd-op-123",
            params: {
                id: swapAssetId
            },
        });
        console.log("getSwapAsset ", getSwapAsset);

        swapAssetOwner = getSwapAsset.data.result.ownership.owner;
        // HERE
        if (getSwapAsset.data.result.ownership.delegated == true) {
            swapDelegate = getSwapAsset.data.result.ownership.delegate;
        }
        swapDatahash = getSwapAsset.data.result.compression.data_hash;
        swapCreatorhash = getSwapAsset.data.result.compression.creator_hash;
        swapLeafId = getSwapAsset.data.result.compression.leaf_id;
        console.log("swap data_hash ", swapDatahash);
        console.log("swap creator_hash ", swapCreatorhash);
        console.log("swap leaf_id ", swapLeafId);

        const getSwapAssetProof = await axiosInstance.post(heliusUrl, {
            jsonrpc: "2.0",
            method: "getAssetProof",
            id: "rpd-op-123",
            params: {
                id: swapAssetId
            },
        });
        console.log("getSwapAssetProof ", getSwapAssetProof);

        swapTreeId =  getSwapAssetProof.data.result.tree_id;
        let swapProofTotal = getSwapAssetProof.data.result.proof;
        swapRoot = getSwapAssetProof.data.result.root;
        console.log("swap tree_id ", swapTreeId);
        console.log("swap proof total ", swapProofTotal);
        console.log("swap root ", swapRoot);

        const swapTreeAccount = await solanaAccountCompression.ConcurrentMerkleTreeAccount.fromAccountAddress(
            connection,
            new solanaWeb3.PublicKey(getSwapAssetProof.data.result.tree_id),
        );
        console.log("swapTreeAccount ", swapTreeAccount);  
        const swapCanopyDepth = swapTreeAccount.getCanopyDepth();
        console.log("swap canopyDepth ", swapCanopyDepth);

        // parse the list of proof addresses into a valid AccountMeta[]
        swapProof = getSwapAssetProof.data.result.proof
            .slice(0, getSwapAssetProof.data.result.proof.length - (!!swapCanopyDepth ? swapCanopyDepth : 0))
            .map((node) => ({
                pubkey: new solanaWeb3.PublicKey(node),
                isWritable: false,
                isSigner: false,
            }));
        console.log("swapProof ", swapProof);
    }

    let swapVaultPDA = solanaWeb3.PublicKey.findProgramAddressSync(
        [Buffer.from("cNFT-vault")],
        cNFTSwapProgramId
    );
    console.log("Swap Vault PDA: ", swapVaultPDA[0].toString());

    if (getAsset.data.result.ownership.owner == swapVaultPDA || swapAssetOwner == swapVaultPDA) {
        console.log("One or both cNFTs are already in the Swap Vault");
        return;
    }

    let swapStatePDA = solanaWeb3.PublicKey.findProgramAddressSync(
        [Buffer.from("cNFT-swap"), new solanaWeb3.PublicKey(assetId).toBytes(), new solanaWeb3.PublicKey(swapAssetId).toBytes()],
        cNFTSwapProgramId
    );
    console.log("Swap State PDA: ", swapStatePDA[0].toString());

    // HERE  I moved cNFTProgramStatePDA to the beginning of this function
    // let cNFTProgramStatePDA = solanaWeb3.PublicKey.findProgramAddressSync(
    //     [Buffer.from("cNFT-program-state")],
    //     cNFTSwapProgramId
    // );
    // console.log("cNFT Program State PDA: ", cNFTProgramStatePDA[0].toString());    

    // HERE  No longer needed
    // const tempFeeAccount = new solanaWeb3.Keypair();
    // console.log("Temp Fee Account: ", tempFeeAccount.publicKey.toString());
    // const createTempFeeAccountIx = solanaWeb3.SystemProgram.createAccount({
    //     programId: cNFTSwapProgramId,
    //     space: 0,
    //     lamports: feeLamports,
    //     fromPubkey: provider.publicKey,
    //     newAccountPubkey: tempFeeAccount.publicKey,
    // });    
    // console.log("Create Temp Fee Account Tx: ", createTempFeeAccountIx);

    let tokenATA = null;
    let createTokenATA = null;
    let createTokenATAIx = null;
    if (swapTokens > 0) {
        tokenATA = await splToken.getAssociatedTokenAddress(
            swapTokenMint,
            provider.publicKey,
            false,
            splToken.TOKEN_PROGRAM_ID,
            splToken.ASSOCIATED_TOKEN_PROGRAM_ID,
        );
        console.log("Token ATA: ", tokenATA.toString());
        
        await connection.getAccountInfo(
            tokenATA
        )
        .then(
            function(response) {
                console.log("tokenATA response ", response);
                if (response == null) {
                    createTokenATA = true;
                    createTokenATAIx = splToken.createAssociatedTokenAccountInstruction(
                        provider.publicKey,
                        tokenATA,
                        provider.publicKey,
                        swapTokenMint,
                        splToken.TOKEN_PROGRAM_ID,
                        splToken.ASSOCIATED_TOKEN_PROGRAM_ID,
                    )
                    console.log("Create Token ATA Ix: ", createTokenATAIx);    
                } else {
                    createTokenATA = false;
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

    // HERE
    var totalSize = 1 + 1 + 32 + 32 + 32 + 32 + 8 + 32 + 32 + 32 + 32 + 32 + 32 + 32 + 8 + 1 + 8 + 32 + 8;
    // var totalSize = 1 + 1 + 32 + 32 + 32 + 32 + 8 + 32 + 32 + 32 + 32 + 8 + 1 + 8 + 32 + 8;
    console.log("totalSize", totalSize);

    var uarray = new Uint8Array(totalSize);
    let counter = 0;    
    uarray[counter++] = 0; // 0 = cnft_swap InitializeSwap instruction

    if (isSwap == true) {
        uarray[counter++] = 1;
    } else {
        uarray[counter++] = 0;
    }
    
    let arr;
    let byte;
    
    let assetIdb58 = bs58.decode(assetId);
    arr = Array.prototype.slice.call(Buffer.from(assetIdb58), 0);
    for (let i = 0; i < arr.length; i++) {
        uarray[counter++] = arr[i];
    }
    
    let rootb58 = bs58.decode(getAssetProof.data.result.root);
    arr = Array.prototype.slice.call(Buffer.from(rootb58), 0);
    for (let i = 0; i < arr.length; i++) {
        uarray[counter++] = arr[i];
    }
    
    let datahashb58 = bs58.decode(getAsset.data.result.compression.data_hash);
    arr = Array.prototype.slice.call(Buffer.from(datahashb58), 0);
    for (let i = 0; i < arr.length; i++) {
        uarray[counter++] = arr[i];
    }
    
    let creatorhashb58 = bs58.decode(getAsset.data.result.compression.creator_hash);
    arr = Array.prototype.slice.call(Buffer.from(creatorhashb58), 0);
    for (let i = 0; i < arr.length; i++) {
        uarray[counter++] = arr[i];
    }

    let byteArray;
    let index;
    
    byteArray = [0, 0, 0, 0, 0, 0, 0, 0];
    for ( index = 0; index < byteArray.length; index ++ ) {
        byte = getAsset.data.result.compression.leaf_id & 0xff;
        byteArray [ index ] = byte;
        getAsset.data.result.compression.leaf_id = (getAsset.data.result.compression.leaf_id - byte) / 256 ;
    }
    for (let i = 0; i < byteArray.length; i++) {
        uarray[counter++] = byteArray[i];
    }
    
    let swapAssetIdb58 = bs58.decode(swapAssetId);
    arr = Array.prototype.slice.call(Buffer.from(swapAssetIdb58), 0);
    for (let i = 0; i < arr.length; i++) {
        uarray[counter++] = arr[i];
    }

    // HERE
    let swapTreeId58 = bs58.decode(swapTreeId);
    arr = Array.prototype.slice.call(Buffer.from(swapTreeId58), 0);
    for (let i = 0; i < arr.length; i++) {
        uarray[counter++] = arr[i];
    }
    
    let swapAssetRootb58 = bs58.decode(swapRoot);
    arr = Array.prototype.slice.call(Buffer.from(swapAssetRootb58), 0);
    for (let i = 0; i < arr.length; i++) {
        uarray[counter++] = arr[i];
    }
    
    let swapAssetDatahashb58 = bs58.decode(swapDatahash); 
    arr = Array.prototype.slice.call(Buffer.from(swapAssetDatahashb58), 0);
    for (let i = 0; i < arr.length; i++) {
        uarray[counter++] = arr[i];
    }
    
    let swapAssetCreatorhashb58 = bs58.decode(swapCreatorhash); 
    arr = Array.prototype.slice.call(Buffer.from(swapAssetCreatorhashb58), 0);
    for (let i = 0; i < arr.length; i++) {
        uarray[counter++] = arr[i];
    }

    // HERE
    let swapAssetOwnerb58 = bs58.decode(swapAssetOwner); 
    arr = Array.prototype.slice.call(Buffer.from(swapAssetOwnerb58), 0);
    for (let i = 0; i < arr.length; i++) {
        uarray[counter++] = arr[i];
    }

    // HERE
    let swapDelegateb58 = bs58.decode(swapDelegate); 
    arr = Array.prototype.slice.call(Buffer.from(swapDelegateb58), 0);
    for (let i = 0; i < arr.length; i++) {
        uarray[counter++] = arr[i];
    }
    
    byteArray = [0, 0, 0, 0, 0, 0, 0, 0];
    for ( index = 0; index < byteArray.length; index ++ ) {
        byte = swapLeafId & 0xff;
        byteArray [ index ] = byte;
        swapLeafId = (swapLeafId - byte) / 256 ;
    }
    for (let i = 0; i < byteArray.length; i++) {
        uarray[counter++] = byteArray[i];
    }

    uarray[counter++] = proof.length;

    byteArray = [0, 0, 0, 0, 0, 0, 0, 0];
    for ( index = 0; index < byteArray.length; index ++ ) {
        byte = swapLamports & 0xff;
        byteArray [ index ] = byte;
        swapLamports = (swapLamports - byte) / 256 ;
    }
    for (let i = 0; i < byteArray.length; i++) {
        uarray[counter++] = byteArray[i];
    }

    let swapTokenMintb58 = bs58.decode(swapTokenMint.toString());
    arr = Array.prototype.slice.call(Buffer.from(swapTokenMintb58), 0);
    for (let i = 0; i < arr.length; i++) {
        uarray[counter++] = arr[i];
    }

    byteArray = [0, 0, 0, 0, 0, 0, 0, 0];
    for ( index = 0; index < byteArray.length; index ++ ) {
        byte = swapTokens & 0xff;
        byteArray [ index ] = byte;
        swapTokens = (swapTokens - byte) / 256 ;
    }
    for (let i = 0; i < byteArray.length; i++) {
        uarray[counter++] = byteArray[i];
    }

    console.log("Contract Data: ", uarray);

    let keys = [
        { pubkey: provider.publicKey, isSigner: true, isWritable: true }, // 0
        { pubkey: swapVaultPDA[0], isSigner: false, isWritable: true }, // 1
        { pubkey: swapStatePDA[0], isSigner: false, isWritable: true }, // 2
        { pubkey: treeAuthorityPDA, isSigner: false, isWritable: false }, // 3
        { pubkey: new solanaWeb3.PublicKey(getAssetProof.data.result.tree_id), isSigner: false, isWritable: true }, // 4
        { pubkey: delegate, isSigner: false, isWritable: true }, // 5  HERE
        // { pubkey: new solanaWeb3.PublicKey(swapTreeId), isSigner: false, isWritable: false }, // 5  HERE  No longer needed
        // { pubkey: new solanaWeb3.PublicKey(swapAssetOwner), isSigner: false, isWritable: false }, // 6  HERE  No longer needed
        { pubkey: mplBubblegum.PROGRAM_ID, isSigner: false, isWritable: false }, // 6
        { pubkey: solanaAccountCompression.PROGRAM_ID, isSigner: false, isWritable: false }, // 7
        { pubkey: solanaAccountCompression.SPL_NOOP_PROGRAM_ID, isSigner: false, isWritable: false }, // 8
        { pubkey: solanaWeb3.SystemProgram.programId, isSigner: false, isWritable: false }, // 9
        { pubkey: programStatePDA[0], isSigner: false, isWritable: false }, // 10  HERE  I renamed cNFTProgramStatePDA to programStatePDA :)
        // { pubkey: cNFTProgramStatePDA[0], isSigner: false, isWritable: false }, // 11
        // { pubkey: tempFeeAccount.publicKey, isSigner: false, isWritable: true }, // 12  HERE  No longer needed
        { pubkey: devTreasury, isSigner: false, isWritable: true }, // 11
        { pubkey: mcDegensTreasury, isSigner: false, isWritable: true }, // 12
    ];
    for (let i = 0; i < proof.length; i++) {
        keys.push(proof[i]);
    }
    console.log("keys ", keys);

    const initializeSwapIx = new solanaWeb3.TransactionInstruction({
        programId: cNFTSwapProgramId,
        data: Buffer.from(
            uarray
        ),
        keys: keys,
    });
    console.log("Initialize Swap Ix: ", initializeSwapIx);
        
    // HERE BEGIN - I rearranged this section (see Rearrange END)
    // let msLookupTable = new solanaWeb3.PublicKey("ETunTW1EtRgZVuUGAhzjmzAWibsJ4h8CYQ13nMVirXtk"); // devnet
    let msLookupTable = new solanaWeb3.PublicKey("6rztYc8onxK3FUku97XJrzvdZHqWavwx5xw8fB7QufCA"); // mainnet
    let lookupTableAccount = null;
    if (proof.length > 3) {
        const slot = await connection.getSlot();
        const [createALTIx, lookupTableAddress] =
        solanaWeb3.AddressLookupTableProgram.createLookupTable({
            authority: provider.publicKey,
            payer: provider.publicKey,
            recentSlot: slot,
        });
        console.log("Lookup Table Address", lookupTableAddress.toBase58(), lookupTableAddress);

        let proofPubkeys = [];
        for (let i = 0; i < proof.length; i++) {
            proofPubkeys.push(proof[i].pubkey);
        }
        console.log("proofPubkeys ", proofPubkeys);

        const extendALTIx = solanaWeb3.AddressLookupTableProgram.extendLookupTable({
            payer: provider.publicKey,
            authority: provider.publicKey,
            lookupTable: lookupTableAddress,
            addresses: [
                // HERE
                // cNFTSwapProgramId,
                // solanaWeb3.SystemProgram.programId,
                // mplBubblegum.PROGRAM_ID,
                // solanaAccountCompression.PROGRAM_ID,
                // solanaAccountCompression.SPL_NOOP_PROGRAM_ID,
                // swapVaultPDA[0],
                // devTreasury,
                // mcDegensTreasury,
                ...proofPubkeys,
            ],
        });
        console.log("extendALTIx ", extendALTIx);

        const msLookupTableAccount = await connection
            .getAddressLookupTable(msLookupTable)
            .then((res) => res.value);
        if (!msLookupTableAccount) {
            console.log("Could not fetch McSwap ALT!");
            return;
        }    

        let mcswapMessageV0 = new solanaWeb3.TransactionMessage({
            payerKey: provider.publicKey,
            recentBlockhash: (await connection.getRecentBlockhash('confirmed')).blockhash,
            instructions: [createALTIx, extendALTIx],
        }).compileToV0Message([msLookupTableAccount]);

        const createALTTx = new solanaWeb3.VersionedTransaction(mcswapMessageV0);
        try {
            let signedTx = await provider.signTransaction(createALTTx);
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

        await new Promise(_ => setTimeout(_, 10000));

        lookupTableAccount = await connection
            .getAddressLookupTable(lookupTableAddress)
            .then((res) => res.value);    
    } else {        
        lookupTableAccount = await connection
            .getAddressLookupTable(msLookupTable)
            .then((res) => res.value);    
    }
    if (!lookupTableAccount) {
        console.log("Could not fetch ALT!");
        return;
    }
    // HERE Rearrange END

    let messageV0 = null;
    if (createTokenATA == true) {
        messageV0 = new solanaWeb3.TransactionMessage({
            payerKey: provider.publicKey,
            recentBlockhash: (await connection.getRecentBlockhash('confirmed')).blockhash,
            instructions: [createTokenATAIx, initializeSwapIx],  // HERE
            // instructions: [createTempFeeAccountIx, createTokenATAIx, initializeSwapIx],
        }).compileToV0Message([lookupTableAccount]);
        console.log("token");
    } else {
        messageV0 = new solanaWeb3.TransactionMessage({
            payerKey: provider.publicKey,
            recentBlockhash: (await connection.getRecentBlockhash('confirmed')).blockhash,
            instructions: [initializeSwapIx],  // HERE
            // instructions: [createTempFeeAccountIx, initializeSwapIx],
        }).compileToV0Message([lookupTableAccount]);
        console.log("none");
    }
    console.log("messageV0 ", messageV0);
    
    const tx = new solanaWeb3.VersionedTransaction(messageV0);
    try {
        let signedTx = await provider.signTransaction(tx);
        // signedTx.sign([tempFeeAccount]);  // HERE
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

async function SwapcNFTs() { 
    if (!wallet_initialized) {
        console.log("Error, wallet not initialized");   
        return
    }
    console.log("Connected to wallet");
    console.log("Provider Pubkey: ", provider.publicKey.toString());
    
    // these are passed
    let assetId = "8rbKH6o4dNGqGJA8NLTFyityY1rTKTekwEMNpRXn9TBK";  // 148
    // let swapAssetId = "11111111111111111111111111111111";  // This should be the value of swapAssetId if NOT swapping
    let swapAssetId = "64XvySfcEUxs9giDuk2agLNJQwEyuZQ2EgY3yeMvcA74";
    console.log("assetId ", assetId);
    console.log("swapAssetId ", swapAssetId);

    let heliusUrl = "https://rpc.helius.xyz/?api-key=HELIUS_KEY";
    let cNFTSwapProgramId = new solanaWeb3.PublicKey("6RUcK9T1hYAZGBxN82ERVDUi4vLAX4hN1zAyy3cU5jav"); // v2

    // HERE  now reading the following 3 vars from program state
    // let devTreasury = new solanaWeb3.PublicKey("2Gs1H87sQDmHS91iXaVQnhdWTGzsgo2vypAwdDRJTLqX");
    // let mcDegensTreasury = new solanaWeb3.PublicKey("GUFxwDrsLzSQ27xxTVe4y9BARZ6cENWmjzwe8XPy7AKu");
    // let feeLamports = 25_000_000;
    // console.log("feeLamports ", feeLamports);
    let programStatePDA = solanaWeb3.PublicKey.findProgramAddressSync(
        [Buffer.from("cNFT-program-state")],
        cNFTSwapProgramId
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

    let swapStatePDA = solanaWeb3.PublicKey.findProgramAddressSync(
        [Buffer.from("cNFT-swap"), new solanaWeb3.PublicKey(assetId).toBytes(), new solanaWeb3.PublicKey(swapAssetId).toBytes()],
        cNFTSwapProgramId
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
    let swapInitializer = null;
    let swapLeafOwner = null;
    let swapDelegate = null;
    let swapLamports = null;
    let swapTokens = null;
    let swapTokenMint = null;
    if (swapState != null) {
        const encodedSwapStateData = swapState.data;
        const decodedSwapStateData = SWAP_STATE.decode(
            encodedSwapStateData
        );
        console.log("swapState - is_initialized: ", decodedSwapStateData.is_initialized);
        console.log("swapState - utime: ", new BN(decodedSwapStateData.utime, 10, "le").toString());  // HERE
        console.log("swapState - initializer: ", new solanaWeb3.PublicKey(decodedSwapStateData.initializer).toString());
        console.log("swapState - delegate: ", new solanaWeb3.PublicKey(decodedSwapStateData.delegate).toString());  // HERE
        console.log("swapState - is_swap: ", new BN(decodedSwapStateData.is_swap, 10, "le").toString()); 
        console.log("swapState - asset_id: ", new solanaWeb3.PublicKey(decodedSwapStateData.asset_id).toString());
        console.log("swapState - merkle_tree: ", new solanaWeb3.PublicKey(decodedSwapStateData.merkle_tree).toString());
        console.log("swapState - root: ", new solanaWeb3.PublicKey(decodedSwapStateData.root).toString());
        console.log("swapState - data_hash: ", new solanaWeb3.PublicKey(decodedSwapStateData.data_hash).toString());
        console.log("swapState - creator_hash: ", new solanaWeb3.PublicKey(decodedSwapStateData.creator_hash).toString());
        console.log("swapState - nonce", new BN(decodedSwapStateData.nonce, 10, "le").toString());

        console.log("swapState - swap_asset_id: ", new solanaWeb3.PublicKey(decodedSwapStateData.swap_asset_id).toString());
        console.log("swapState - swap_merkle_tree: ", new solanaWeb3.PublicKey(decodedSwapStateData.swap_merkle_tree).toString());
        console.log("swapState - swap_root: ", new solanaWeb3.PublicKey(decodedSwapStateData.swap_root).toString());
        console.log("swapState - swap_data_hash: ", new solanaWeb3.PublicKey(decodedSwapStateData.swap_data_hash).toString());
        console.log("swapState - swap_creator_hash: ", new solanaWeb3.PublicKey(decodedSwapStateData.swap_creator_hash).toString());
        console.log("swapState - swap_nonce", new BN(decodedSwapStateData.swap_nonce, 10, "le").toString());
        console.log("swapState - swap_leaf_owner: ", new solanaWeb3.PublicKey(decodedSwapStateData.swap_leaf_owner).toString());
        console.log("swapState - swap_delegate: ", new solanaWeb3.PublicKey(decodedSwapStateData.swap_delegate).toString());  // HERE
        console.log("swapState - swap_lamports", new BN(decodedSwapStateData.swap_lamports, 10, "le").toString());
        console.log("swapState - swap_token_mint", new solanaWeb3.PublicKey(decodedSwapStateData.swap_token_mint).toString());
        console.log("swapState - swap_tokens", new BN(decodedSwapStateData.swap_tokens, 10, "le").toString());

        if (new BN(decodedSwapStateData.is_swap, 10, "le") == 0) {
            isSwap = false
        }
        swapInitializer = new solanaWeb3.PublicKey(decodedSwapStateData.initializer);
        swapLeafOwner = new solanaWeb3.PublicKey(decodedSwapStateData.swap_leaf_owner);
        swapDelegate = new solanaWeb3.PublicKey(decodedSwapStateData.swap_delegate);
        swapLamports = new BN(decodedSwapStateData.swap_lamports, 10, "le");
        swapTokenMint = new solanaWeb3.PublicKey(decodedSwapStateData.swap_token_mint);
        swapTokens = new BN(decodedSwapStateData.swap_tokens, 10, "le");
    } else {
        console.log("Swap Not Initialized");    
        return;
    }
        
    const axiosInstance = axios.create({
        baseURL: heliusUrl,
    });

    const getAsset = await axiosInstance.post(heliusUrl, {
        jsonrpc: "2.0",
        method: "getAsset",
        id: "rpd-op-123",
        params: {
            id: assetId
        },
    });
    console.log("data_hash ", getAsset.data.result.compression.data_hash);
    console.log("creator_hash ", getAsset.data.result.compression.creator_hash);
    console.log("leaf_id ", getAsset.data.result.compression.leaf_id);

    const getAssetProof = await axiosInstance.post(heliusUrl, {
        jsonrpc: "2.0",
        method: "getAssetProof",
        id: "rpd-op-123",
        params: {
            id: assetId
        },
    });
    console.log("tree_id ", getAssetProof.data.result.tree_id);
    console.log("proof ", getAssetProof.data.result.proof);
    console.log("root ", getAssetProof.data.result.root);

    const treeAccount = await solanaAccountCompression.ConcurrentMerkleTreeAccount.fromAccountAddress(
        connection,
        new solanaWeb3.PublicKey(getAssetProof.data.result.tree_id),
    );  
    const treeAuthorityPDA = treeAccount.getAuthority();
    const canopyDepth = treeAccount.getCanopyDepth();
    console.log("treeAuthorityPDA ", treeAuthorityPDA.toString());
    console.log("canopyDepth ", canopyDepth);

    // parse the list of proof addresses into a valid AccountMeta[]
    const proof = getAssetProof.data.result.proof
        .slice(0, getAssetProof.data.result.proof.length - (!!canopyDepth ? canopyDepth : 0))
        .map((node) => ({
            pubkey: new solanaWeb3.PublicKey(node),
            isWritable: false,
            isSigner: false,
        }));
    console.log("proof ", proof);

    let swapDatahash = "11111111111111111111111111111111";
    let swapCreatorhash = "11111111111111111111111111111111";
    let swapLeafId = 0;
    let swapTreeId = "11111111111111111111111111111111";
    let swapRoot = "11111111111111111111111111111111";
    let swapTreeAuthorityPDA = new solanaWeb3.PublicKey("11111111111111111111111111111111");
    let swapProof = null;
    if (isSwap == true) {
        const getSwapAsset = await axiosInstance.post(heliusUrl, {
            jsonrpc: "2.0",
            method: "getAsset",
            id: "rpd-op-123",
            params: {
                id: swapAssetId
            },
        });
        swapDatahash = getSwapAsset.data.result.compression.data_hash;
        swapCreatorhash = getSwapAsset.data.result.compression.creator_hash;
        swapLeafId = getSwapAsset.data.result.compression.leaf_id;
        console.log("swap data_hash ", swapDatahash);
        console.log("swap creator_hash ", swapCreatorhash);
        console.log("swap leaf_id ", swapLeafId);

        const getSwapAssetProof = await axiosInstance.post(heliusUrl, {
            jsonrpc: "2.0",
            method: "getAssetProof",
            id: "rpd-op-123",
            params: {
                id: swapAssetId
            },
        });
        swapTreeId = getSwapAssetProof.data.result.tree_id;
        swapRoot = getSwapAssetProof.data.result.root;
        console.log("swap proof total ", getSwapAssetProof.data.result.proof);
        console.log("swap tree_id ", swapTreeId);
        console.log("swap root ", swapRoot);

        const swapTreeAccount = await solanaAccountCompression.ConcurrentMerkleTreeAccount.fromAccountAddress(
            connection,
            new solanaWeb3.PublicKey(getSwapAssetProof.data.result.tree_id),
        );
        console.log("swapTreeAccount ", swapTreeAccount);  
        swapTreeAuthorityPDA = swapTreeAccount.getAuthority();
        const swapCanopyDepth = swapTreeAccount.getCanopyDepth();
        console.log("swap treeAuthorityPDA ", swapTreeAuthorityPDA.toString());
        console.log("swap canopyDepth ", swapCanopyDepth);

        // parse the list of proof addresses into a valid AccountMeta[]
        swapProof = getSwapAssetProof.data.result.proof
            .slice(0, getSwapAssetProof.data.result.proof.length - (!!swapCanopyDepth ? swapCanopyDepth : 0))
            .map((node) => ({
                pubkey: new solanaWeb3.PublicKey(node),
                isWritable: false,
                isSigner: false,
            }));        
        console.log("swapProof ", swapProof);
    }

    let swapVaultPDA = solanaWeb3.PublicKey.findProgramAddressSync(
        [Buffer.from("cNFT-vault")],
        cNFTSwapProgramId
    );
    console.log("Swap Vault PDA: ", swapVaultPDA[0].toString());

    if (getAsset.data.result.ownership.owner == swapVaultPDA || swapLeafOwner == swapVaultPDA) { 
        console.log("One or both cNFTs are already in the Swap Vault");
        return
    }    
    
    // HERE  I moved cNFTProgramStatePDA to the beginning of this function
    // let cNFTProgramStatePDA = solanaWeb3.PublicKey.findProgramAddressSync(
    //     [Buffer.from("cNFT-program-state")],
    //     cNFTSwapProgramId
    // );
    // console.log("cNFT Program State PDA: ", cNFTProgramStatePDA[0].toString());    

    // HERE  No longer needed
    // const totalFee = parseInt(feeLamports) + parseInt(swapLamports);
    // console.log("totalFee ", totalFee);
    // const tempFeeAccount = new solanaWeb3.Keypair();
    // console.log("Temp Fee Account: ", tempFeeAccount.publicKey.toString());
    // const createTempFeeAccountIx = solanaWeb3.SystemProgram.createAccount({
    //     programId: cNFTSwapProgramId,
    //     space: 0,
    //     lamports: totalFee,
    //     fromPubkey: provider.publicKey,
    //     newAccountPubkey: tempFeeAccount.publicKey,
    // });    
    // console.log("Create Temp Fee Account Ix: ", createTempFeeAccountIx);

    const providerTokenATA = await splToken.getAssociatedTokenAddress(
        swapTokenMint,
        provider.publicKey,
        false,
        splToken.TOKEN_PROGRAM_ID,
        splToken.ASSOCIATED_TOKEN_PROGRAM_ID,
    );
    console.log("Provider Token ATA: ", providerTokenATA.toString());

    // HERE  No longer needed
    // const tempTokenAccount = new solanaWeb3.Keypair();
    // let createTempTokenAccountIx = null;
    // let initTempTokenAccountIx = null;
    // let transferTokenIx = null;
    // if (swapTokens > 0) {
    //     console.log("Temp Token Account: ", tempTokenAccount.publicKey.toString());
    //     createTempTokenAccountIx = solanaWeb3.SystemProgram.createAccount({
    //         programId: splToken.TOKEN_PROGRAM_ID,
    //         space: splToken.AccountLayout.span,
    //         lamports: await connection.getMinimumBalanceForRentExemption(
    //             splToken.AccountLayout.span
    //         ),
    //         fromPubkey: provider.publicKey,
    //         newAccountPubkey: tempTokenAccount.publicKey,
    //     });    
    //     console.log("Create Temp Token Account Ix: ", createTempFeeAccountIx);    

    //     initTempTokenAccountIx = splToken.createInitializeAccountInstruction(
    //         tempTokenAccount.publicKey,
    //         swapTokenMint,
    //         tempTokenAccount.publicKey,
    //         splToken.TOKEN_PROGRAM_ID
    //     );
    //     console.log("Init Temp Token Account Ix: ", initTempTokenAccountIx)

    //     transferTokenIx = splToken.createTransferInstruction(
    //         providerTokenATA,
    //         tempTokenAccount.publicKey,
    //         provider.publicKey,
    //         parseInt(swapTokens),
    //         provider.publicKey,
    //         splToken.TOKEN_PROGRAM_ID,
    //     )
    //     console.log("Transfer Token Ix: ", transferTokenIx);
    // }

    const initializerTokenATA = await splToken.getAssociatedTokenAddress(
        swapTokenMint,
        swapInitializer,
        false,
        splToken.TOKEN_PROGRAM_ID,
        splToken.ASSOCIATED_TOKEN_PROGRAM_ID,
    );
    console.log("Initializer Token ATA: ", initializerTokenATA.toString());
 
    var totalSize = 1 + 32 + 32 + 1 + 1;
    console.log("totalSize", totalSize);

    var uarray = new Uint8Array(totalSize);
    let counter = 0;    
    uarray[counter++] = 1; // 1 = cnft_swap SwapcNFTs instruction
    
    let assetIdb58 = bs58.decode(assetId);
    var arr = Array.prototype.slice.call(Buffer.from(assetIdb58), 0);
    for (let i = 0; i < arr.length; i++) {
        uarray[counter++] = arr[i];
    }
    
    let swapAssetIdb58 = bs58.decode(swapAssetId);
    var arr = Array.prototype.slice.call(Buffer.from(swapAssetIdb58), 0);
    for (let i = 0; i < arr.length; i++) {
        uarray[counter++] = arr[i];
    }
    
    uarray[counter++] = proof.length;
    if (isSwap == true) {
        uarray[counter++] = swapProof.length;
    } else {
        uarray[counter++] = 0;
    }

    console.log("Contract Data: ", uarray);

    let keys = [
        { pubkey: provider.publicKey, isSigner: true, isWritable: true }, // 0
        { pubkey: new solanaWeb3.PublicKey(swapInitializer), isSigner: false, isWritable: true }, // 1
        { pubkey: swapVaultPDA[0], isSigner: false, isWritable: true }, // 2
        { pubkey: swapStatePDA[0], isSigner: false, isWritable: true }, // 3
        { pubkey: treeAuthorityPDA, isSigner: false, isWritable: false }, // 4
        { pubkey: new solanaWeb3.PublicKey(getAssetProof.data.result.tree_id), isSigner: false, isWritable: true }, // 5
        { pubkey: swapTreeAuthorityPDA, isSigner: false, isWritable: false }, // 6
        { pubkey: new solanaWeb3.PublicKey(swapTreeId), isSigner: false, isWritable: true }, // 7 
        { pubkey: new solanaWeb3.PublicKey(swapDelegate), isSigner: false, isWritable: true }, // 8  HERE
        { pubkey: mplBubblegum.PROGRAM_ID, isSigner: false, isWritable: false }, // 9
        { pubkey: solanaAccountCompression.PROGRAM_ID, isSigner: false, isWritable: false }, // 10
        { pubkey: solanaAccountCompression.SPL_NOOP_PROGRAM_ID, isSigner: false, isWritable: false }, // 11
        { pubkey: solanaWeb3.SystemProgram.programId, isSigner: false, isWritable: false }, // 12
        { pubkey: splToken.TOKEN_PROGRAM_ID, isSigner: false, isWritable: false }, // 13
        { pubkey: programStatePDA[0], isSigner: false, isWritable: false }, // 14  HERE Changed cNFTProgramStatePDA to programStatePDA :)
        // { pubkey: cNFTProgramStatePDA[0], isSigner: false, isWritable: false }, // 13
        // { pubkey: tempFeeAccount.publicKey, isSigner: true, isWritable: true }, // 14  HERE No longer needed
        { pubkey: providerTokenATA, isSigner: false, isWritable: true }, // 15  HERE Changed tempTokenAccount to providerTokenATA
        // { pubkey: tempTokenAccount.publicKey, isSigner: true, isWritable: true }, // 14
        { pubkey: initializerTokenATA, isSigner: false, isWritable: true }, // 16
        { pubkey: devTreasury, isSigner: false, isWritable: true }, // 17
        { pubkey: mcDegensTreasury, isSigner: false, isWritable: true }, // 18
    ];
    for (let i = 0; i < proof.length; i++) {
        keys.push(proof[i]);
    }    
    if (isSwap == true) {
        for (let i = 0; i < swapProof.length; i++) {
            keys.push(swapProof[i]);
        }
    }
    console.log("keys ", keys);

    const swapcNFTsIx = new solanaWeb3.TransactionInstruction({
        programId: cNFTSwapProgramId,
        data: Buffer.from(
            uarray
        ),
        keys: keys,
    });
    console.log("Swap NFTs Ix: ", swapcNFTsIx);
        
    // HERE BEGIN - I rearranged this section (see Rearrange END)
    // let msLookupTable = new solanaWeb3.PublicKey("ETunTW1EtRgZVuUGAhzjmzAWibsJ4h8CYQ13nMVirXtk"); // devnet
    let msLookupTable = new solanaWeb3.PublicKey("6rztYc8onxK3FUku97XJrzvdZHqWavwx5xw8fB7QufCA"); // mainnet
    let lookupTableAccount = null;
    if (proof.length + swapProof.length > 6) {
        const slot = await connection.getSlot();
        const [createALTIx, lookupTableAddress] =
        solanaWeb3.AddressLookupTableProgram.createLookupTable({
            authority: provider.publicKey,
            payer: provider.publicKey,
            recentSlot: slot,
        });
        console.log("Lookup Table Address", lookupTableAddress.toBase58());

        let proofPubkeys = [];
        for (let i = 0; i < proof.length; i++) {
            proofPubkeys.push(proof[i].pubkey);
        }
        console.log("proofPubkeys ", proofPubkeys);
        
        let swapProofPubkeys = [];
        if (isSwap == true) {
            // for (let i = 0; i < swapProof.length; i++) {  HERE
            for (let i = 0; i < swapProof.length - 1; i++) {  // The magic - 1 :)
                swapProofPubkeys.push(swapProof[i].pubkey);
            }
        }
        console.log("swapProofPubkeys ", swapProofPubkeys);

        // HERE 
        let extendALTIx = null;
        if (isSwap == true) {
            extendALTIx = solanaWeb3.AddressLookupTableProgram.extendLookupTable({
                payer: provider.publicKey,
                authority: provider.publicKey,
                lookupTable: lookupTableAddress,
                addresses: [
                    // cNFTSwapProgramId,
                    // solanaWeb3.SystemProgram.programId,
                    // mplBubblegum.PROGRAM_ID,
                    // solanaAccountCompression.PROGRAM_ID,
                    // solanaWeb3.SystemProgram.programId,
                    // splToken.TOKEN_PROGRAM_ID,
                    // devTreasury,
                    // mcDegensTreasury,
                    // provider.publicKey,
                    // new solanaWeb3.PublicKey(swapInitializer),
                    // solanaAccountCompression.SPL_NOOP_PROGRAM_ID,
                    // programStatePDA[0],
                    // swapVaultPDA[0],
                    // swapStatePDA[0],
                    // treeAuthorityPDA,
                    // new solanaWeb3.PublicKey(getAssetProof.data.result.tree_id),
                    // swapTreeAuthorityPDA,
                    // new solanaWeb3.PublicKey(swapTreeId),
                    // initializerTokenATA,
                    ...proofPubkeys,                
                    ...swapProofPubkeys,
                ],
            });
        } else {
            extendALTIx = solanaWeb3.AddressLookupTableProgram.extendLookupTable({
                payer: provider.publicKey,
                authority: provider.publicKey,
                lookupTable: lookupTableAddress,
                addresses: [
                    // provider.publicKey,
                    // new solanaWeb3.PublicKey(swapInitializer),
                    // cNFTSwapProgramId,
                    // solanaWeb3.SystemProgram.programId,
                    // mplBubblegum.PROGRAM_ID,
                    // solanaAccountCompression.PROGRAM_ID,
                    // solanaAccountCompression.SPL_NOOP_PROGRAM_ID,
                    // swapVaultPDA[0],
                    // swapStatePDA[0],
                    // devTreasury,
                    // mcDegensTreasury,
                    // treeAuthorityPDA,
                    // new solanaWeb3.PublicKey(getAssetProof.data.result.tree_id),
                    // swapTreeAuthorityPDA,
                    // new solanaWeb3.PublicKey(swapTreeId),
                    // solanaWeb3.SystemProgram.programId,
                    // splToken.TOKEN_PROGRAM_ID,
                    // programStatePDA[0],
                    // initializerTokenATA,
                    ...proofPubkeys,
                ],
            });
        }
        console.log("extendALTIx ", extendALTIx);

        const msLookupTableAccount = await connection
            .getAddressLookupTable(msLookupTable)
            .then((res) => res.value);
        if (!msLookupTable) {
            console.log("Could not fetch McSwap ALT!");
            return;
        }    

        let mcswapMessageV0 = new solanaWeb3.TransactionMessage({
            payerKey: provider.publicKey,
            recentBlockhash: (await connection.getRecentBlockhash('confirmed')).blockhash,
            instructions: [createALTIx, extendALTIx],
        }).compileToV0Message([msLookupTableAccount]);

        const createALTTx = new solanaWeb3.VersionedTransaction(mcswapMessageV0);
        try {
            let signedTx = await provider.signTransaction(createALTTx);
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

        await new Promise(_ => setTimeout(_, 10000));

        lookupTableAccount = await connection
            .getAddressLookupTable(lookupTableAddress)
            .then((res) => res.value);    
    } else {
        lookupTableAccount = await connection
            .getAddressLookupTable(msLookupTable)
            .then((res) => res.value);
    }
    // HERE Rearrange END
    
    if (!lookupTableAccount) {
        console.log("Could not fetch ALT!");
        return;
    }

    // HERE Compute unit instructions
    // Create the priority fee instructions
    const computePriceIx = solanaWeb3.ComputeBudgetProgram.setComputeUnitPrice({
        microLamports: 100,
    });

    const computeLimitIx = solanaWeb3.ComputeBudgetProgram.setComputeUnitLimit({
        units: 250000,
    });

    // HERE    
    let messageV0 = new solanaWeb3.TransactionMessage({
        payerKey: provider.publicKey,
        recentBlockhash: (await connection.getRecentBlockhash('confirmed')).blockhash,
        instructions: [computePriceIx, computeLimitIx, swapcNFTsIx],
    }).compileToV0Message([lookupTableAccount]);
    // let messageV0 = null;
    // if (swapTokens > 0) {
    //     messageV0 = new solanaWeb3.TransactionMessage({
    //         payerKey: provider.publicKey,
    //         recentBlockhash: (await connection.getRecentBlockhash('confirmed')).blockhash,
    //         instructions: [
    //             createTempFeeAccountIx, 
    //             createTempTokenAccountIx, 
    //             initTempTokenAccountIx, 
    //             transferTokenIx, 
    //             swapcNFTsIx],
    //     }).compileToV0Message([lookupTableAccount]);
    // } else {
    //     messageV0 = new solanaWeb3.TransactionMessage({
    //         payerKey: provider.publicKey,
    //         recentBlockhash: (await connection.getRecentBlockhash('confirmed')).blockhash,
    //         instructions: [createTempFeeAccountIx, swapcNFTsIx],
    //     }).compileToV0Message([lookupTableAccount]);
    // }
    console.log("messageV0 ", messageV0);
    
    const tx = new solanaWeb3.VersionedTransaction(messageV0);
    try {
        let signedTx = await provider.signTransaction(tx);
        // signedTx.sign([tempFeeAccount, tempTokenAccount]);  // HERE No longer needed
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

    // these are passed
    let assetId = "6Vk5JXztMEJF12JSGsrKcYfCd5rKVyt44BPaKvbv66WU";
    // let swapAssetId = "11111111111111111111111111111111";  // This should be the value of swapAssetId if NOT swapping
    let swapAssetId = "G8WwLEGDjY659NMLNHDBLyvKQJk9WGJZ4TQp7p4pLHdF";
    console.log("assetId ", assetId);
    console.log("swapAssetId ", swapAssetId);

    let heliusUrl = "https://rpc.helius.xyz/?api-key=HELIUS_KEY";

    // let cNFTSwapProgramId = new solanaWeb3.PublicKey("ABDXeLg3NiQKf7xRyEjZ3HTCTP1dWezCAjVmxJ8NdWz1"); // v1
    let cNFTSwapProgramId = new solanaWeb3.PublicKey("6RUcK9T1hYAZGBxN82ERVDUi4vLAX4hN1zAyy3cU5jav"); // v2
   
    let swapStatePDA = solanaWeb3.PublicKey.findProgramAddressSync(
        [Buffer.from("cNFT-swap"), new solanaWeb3.PublicKey(assetId).toBytes(), new solanaWeb3.PublicKey(swapAssetId).toBytes()],
        cNFTSwapProgramId
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
        console.log("swapState - utime: ", new BN(decodedSwapStateData.utime, 10, "le").toString());  // HERE
        console.log("swapState - initializer: ", new solanaWeb3.PublicKey(decodedSwapStateData.initializer).toString());
        console.log("swapState - delegate: ", new solanaWeb3.PublicKey(decodedSwapStateData.delegate).toString());  // HERE
        console.log("swapState - asset_id: ", new solanaWeb3.PublicKey(decodedSwapStateData.asset_id).toString());
        console.log("swapState - merkle_tree: ", new solanaWeb3.PublicKey(decodedSwapStateData.merkle_tree).toString());
        console.log("swapState - root: ", new solanaWeb3.PublicKey(decodedSwapStateData.root).toString());
        console.log("swapState - data_hash: ", new solanaWeb3.PublicKey(decodedSwapStateData.data_hash).toString());
        console.log("swapState - creator_hash: ", new solanaWeb3.PublicKey(decodedSwapStateData.creator_hash).toString());
        console.log("swapState - nonce", new BN(decodedSwapStateData.nonce, 10, "le").toString());

        console.log("swapState - swap_asset_id: ", new solanaWeb3.PublicKey(decodedSwapStateData.swap_asset_id).toString());
        console.log("swapState - swap_merkle_tree: ", new solanaWeb3.PublicKey(decodedSwapStateData.swap_merkle_tree).toString());
        console.log("swapState - swap_root: ", new solanaWeb3.PublicKey(decodedSwapStateData.swap_root).toString());
        console.log("swapState - swap_data_hash: ", new solanaWeb3.PublicKey(decodedSwapStateData.swap_data_hash).toString());
        console.log("swapState - swap_creator_hash: ", new solanaWeb3.PublicKey(decodedSwapStateData.swap_creator_hash).toString());
        console.log("swapState - swap_nonce", new BN(decodedSwapStateData.swap_nonce, 10, "le").toString());
        console.log("swapState - swap_leaf_owner: ", new solanaWeb3.PublicKey(decodedSwapStateData.swap_leaf_owner).toString());
        console.log("swapState - swap_delegate: ", new solanaWeb3.PublicKey(decodedSwapStateData.swap_delegate).toString());  // HERE        
        console.log("swapState - swap_lamports", new BN(decodedSwapStateData.swap_lamports, 10, "le").toString());
    } else {
        console.log("Swap Not Initialized");
        return;
    }

    const axiosInstance = axios.create({
        baseURL: heliusUrl,
    });

    const getAsset = await axiosInstance.post(heliusUrl, {
        jsonrpc: "2.0",
        method: "getAsset",
        id: "rpd-op-123",
        params: {
            id: assetId
        },
    });
    console.log("data_hash ", getAsset.data.result.compression.data_hash);
    console.log("creator_hash ", getAsset.data.result.compression.creator_hash);
    console.log("leaf_id ", getAsset.data.result.compression.leaf_id);

    const getAssetProof = await axiosInstance.post(heliusUrl, {
        jsonrpc: "2.0",
        method: "getAssetProof",
        id: "rpd-op-123",
        params: {
            id: assetId
        },
    });
    console.log("tree_id ", getAssetProof.data.result.tree_id);
    console.log("node_index ", getAssetProof.data.result.node_index);
    console.log("proof ", getAssetProof.data.result.proof);
    console.log("root ", getAssetProof.data.result.root);

    const treeAccount = await solanaAccountCompression.ConcurrentMerkleTreeAccount.fromAccountAddress(
        connection,
        new solanaWeb3.PublicKey(getAssetProof.data.result.tree_id),
    );  
    const treeAuthorityPDA = treeAccount.getAuthority();
    const canopyDepth = treeAccount.getCanopyDepth();
    console.log("treeAuthorityPDA ", treeAuthorityPDA.toString());
    console.log("canopyDepth ", canopyDepth);

    // parse the list of proof addresses into a valid AccountMeta[]
    const proof = getAssetProof.data.result.proof
        .slice(0, getAssetProof.data.result.proof.length - (!!canopyDepth ? canopyDepth : 0))
        .map((node) => ({
            pubkey: new solanaWeb3.PublicKey(node),
            isWritable: false,
            isSigner: false,
        }));
    console.log("proof ", proof);

    let swapVaultPDA = solanaWeb3.PublicKey.findProgramAddressSync(
        [Buffer.from("cNFT-vault")],
        cNFTSwapProgramId
    );
    console.log("Swap Vault PDA: ", swapVaultPDA[0].toString());

    var totalSize = 1 + 32 + 32 + 1;
    console.log("totalSize", totalSize);

    var uarray = new Uint8Array(totalSize);
    let counter = 0;    
    uarray[counter++] = 2; // 2 = cnft_swap ReverseSwap instruction
    
    let assetIdb58 = bs58.decode(assetId);
    var arr = Array.prototype.slice.call(Buffer.from(assetIdb58), 0);
    for (let i = 0; i < arr.length; i++) {
        uarray[counter++] = arr[i];
    }
    
    let swapAssetIdb58 = bs58.decode(swapAssetId);
    var arr = Array.prototype.slice.call(Buffer.from(swapAssetIdb58), 0);
    for (let i = 0; i < arr.length; i++) {
        uarray[counter++] = arr[i];
    }

    uarray[counter++] = proof.length;

    console.log("Contract Data: ", uarray);

    let keys = [
        { pubkey: provider.publicKey, isSigner: true, isWritable: true }, // 0
        { pubkey: swapVaultPDA[0], isSigner: false, isWritable: true }, // 1
        { pubkey: swapStatePDA[0], isSigner: false, isWritable: true }, // 2
        { pubkey: treeAuthorityPDA, isSigner: false, isWritable: false }, // 3
        { pubkey: new solanaWeb3.PublicKey(getAssetProof.data.result.tree_id), isSigner: false, isWritable: true }, // 4
        { pubkey: mplBubblegum.PROGRAM_ID, isSigner: false, isWritable: false }, // 5
        { pubkey: solanaAccountCompression.PROGRAM_ID, isSigner: false, isWritable: false }, // 6
        { pubkey: solanaAccountCompression.SPL_NOOP_PROGRAM_ID, isSigner: false, isWritable: false }, // 7
        { pubkey: solanaWeb3.SystemProgram.programId, isSigner: false, isWritable: false }, // 8
    ];
    for (let i = 0; i < proof.length; i++) {
        keys.push(proof[i]);
    }
    console.log("keys ", keys);

    const reverseSwapIx = new solanaWeb3.TransactionInstruction({
        programId: cNFTSwapProgramId,
        data: Buffer.from(
            uarray
        ),
        keys: keys,
    });
    console.log("Reverse Swap Ix: ", reverseSwapIx);

    let tx = new solanaWeb3.Transaction();
    tx.add(reverseSwapIx);
    tx.recentBlockhash = (await connection.getRecentBlockhash('confirmed')).blockhash;
    tx.feePayer = provider.publicKey;
    console.log("Start Tx");
    try {
        let signedTransaction = await provider.signTransaction(tx);
        console.log("Tx: ", tx);
        const serializedTransaction = signedTransaction.serialize();
        const signature = await connection.sendRawTransaction(
            serializedTransaction,
            { skipPreflight: false, preflightCommitment: 'confirmed' },
        );        
        console.log("Signature: ", signature);
        console.log(`https://solscan.io/tx/${signature}?cluster=mainnet`);
    } catch(error) {
        console.log("Error: ", error)
        error = JSON.stringify(error);
        error = JSON.parse(error);
        console.log("Error Logs: ", error)
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
    let newFeeLamports = 12500000; // 0
    let newDevPercentage = 75; // 0
    let newDevTreasury = "2Gs1H87sQDmHS91iXaVQnhdWTGzsgo2vypAwdDRJTLqX"; // "11111111111111111111111111111111"
    let newMcDegensTreasury = "GUFxwDrsLzSQ27xxTVe4y9BARZ6cENWmjzwe8XPy7AKu";

    // let cNFTSwapProgramId = new solanaWeb3.PublicKey("8Tg1SpWz9JNr5praJssiALNs3G6GQU5qvuoxf85aRh74"); // v1
    let cNFTSwapProgramId = new solanaWeb3.PublicKey("6RUcK9T1hYAZGBxN82ERVDUi4vLAX4hN1zAyy3cU5jav"); // v2
    let cNFTProgramStatePDA = solanaWeb3.PublicKey.findProgramAddressSync(
        [Buffer.from("cNFT-program-state")],
        cNFTSwapProgramId
    );
    console.log("cNFT Program State PDA: ", cNFTProgramStatePDA[0].toString());

    var totalSize = 1 + 8 + 1 + 32 + 32
    console.log("totalSize", totalSize);

    var uarray = new Uint8Array(totalSize);    
    let counter = 0;
    
    uarray[counter++] = 3; // 3 =  cnft_swap UpdateState instruction

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
    
    const cNFTSwapUpdateStateTx = new solanaWeb3.TransactionInstruction({
        programId: cNFTSwapProgramId,
        data: Buffer.from(
            uarray
        ),
        keys: [
            { pubkey: provider.publicKey, isSigner: true, isWritable: true }, // 0
            { pubkey: cNFTProgramStatePDA[0], isSigner: false, isWritable: true }, // 1
            { pubkey: solanaWeb3.SystemProgram.programId, isSigner: false, isWritable: false }, // 3
        ],        
    });
    console.log("cNFT Swap Update State Tx: ", cNFTSwapUpdateStateTx);

    let tx = new solanaWeb3.Transaction();
    tx.add(cNFTSwapUpdateStateTx);
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

async function CreateALT() {
    if (!wallet_initialized) {
        console.log("Error, wallet not initialized");
        return
    }
    console.log("Connected to wallet");
    console.log("Provider Pubkey: ", provider.publicKey.toString());

    // let NFTSwapProgramId = new solanaWeb3.PublicKey("AyJBbGQzUQSvhivZnHMDCCk6eSLupkeBh4fvMAD8T4Xx");
    let programId = new solanaWeb3.PublicKey("FRRYhLWhGZYb63HEwuVTu5VY7EY3Gwr9UXTc84ghwCiu");

    const slot = await connection.getSlot();

    const [lookupTableIx, lookupTableAddress] =
    solanaWeb3.AddressLookupTableProgram.createLookupTable({
        authority: provider.publicKey,
        payer: provider.publicKey,
        recentSlot: slot,
    });
    console.log("Lookup Table Address", lookupTableAddress.toBase58());

    const extendIx = solanaWeb3.AddressLookupTableProgram.extendLookupTable({
        payer: provider.publicKey,
        authority: provider.publicKey,
        lookupTable: lookupTableAddress,
        addresses: [
            programId,
            solanaWeb3.SystemProgram.programId,
            // splToken.TOKEN_PROGRAM_ID,
            // splToken.ASSOCIATED_TOKEN_PROGRAM_ID,
            solanaAccountCompression.PROGRAM_ID,
            solanaAccountCompression.SPL_NOOP_PROGRAM_ID,
            mplBubblegum.PROGRAM_ID,
            // new solanaWeb3.PublicKey("GXJxtgVVxucy4QgHqHzJSYR2EbL5hgsLdNLui9HwJjsc"),
            // new solanaWeb3.PublicKey("6TaXuGHg2ttaG4BMFVM9XgZEXJTCWG56bWvQtf7rFqmD"),
            // new solanaWeb3.PublicKey("ASxZpf2cyPPY1zvuypHKkpS4uBN1sGYg3x5fbk4LvkSn"),
            // new solanaWeb3.PublicKey("3xRB4nhyEYW75cPETQqZKRvP9dE9gJ9x2Zb41nkH2L8g"),
        ],
    });

    let tx = new solanaWeb3.Transaction();
    tx.add(lookupTableIx, extendIx);
    tx.recentBlockhash = (await connection.getRecentBlockhash('confirmed')).blockhash;
    tx.feePayer = provider.publicKey;
    console.log("Start Tx");
    try {
        let signedTransaction = await provider.signTransaction(tx);
        console.log("Tx: ", tx);
        const serializedTransaction = signedTransaction.serialize();
        const signature = await connection.sendRawTransaction(
            serializedTransaction,
            { skipPreflight: false, preflightCommitment: 'confirmed' },
        );        
        console.log("Signature: ", signature);
        console.log(`https://solscan.io/tx/${signature}?cluster=mainnet`);    
    } catch(error) {
        console.log("Error: ", error)
        error = JSON.stringify(error);
        error = JSON.parse(error);
        console.log("Error Logs: ", error)
        return;
    }
}

async function ExtendALT() {
    if (!wallet_initialized) {
        console.log("Error, wallet not initialized");
        return
    }
    console.log("Connected to wallet");
    console.log("Provider Pubkey: ", provider.publicKey.toString());
    
    const lookupTableAddress = new solanaWeb3.PublicKey("6NVtn6zJDzSpgPxPRtd6UAoWkDxmuqv2HgCLLJEeQLY");
    // let assetId = "D1s95FARscvAUcm9iuv2L8ZAEJZ3m7LAJ1PdeA3pDko9";

    // const axiosInstance = axios.create({
    //     baseURL: heliusUrl,
    // });

    // const getAssetProof = await axiosInstance.post(heliusUrl, {
    //     jsonrpc: "2.0",
    //     method: "getAssetProof",
    //     id: "rpd-op-123",
    //     params: {
    //         id: assetId
    //     },
    // });
    // let proof = getAssetProof.data.result.proof;
    // console.log("proof ", proof);

    // let proofPubkeys = [];
    // for (let i = 0; i < proof.length; i++) {
    //     proofPubkeys.push(new solanaWeb3.PublicKey(proof[i]));
	// }
    // console.log("proofPubkeys ", p`roofPubkeys);

    const extendIx = solanaWeb3.AddressLookupTableProgram.extendLookupTable({
        payer: provider.publicKey,
        authority: provider.publicKey,
        lookupTable: lookupTableAddress,
        addresses: [
            new solanaWeb3.PublicKey("GwR3T5wAAWRCCNyjCs2g9aUM7qAtwNBsn2Z515oGTi7i"),
            // ...proofPubkeys
        ],
    });
    console.log("extendIx ", extendIx);

    let tx = new solanaWeb3.Transaction();
    tx.add(extendIx);
    tx.recentBlockhash = (await connection.getRecentBlockhash('confirmed')).blockhash;
    tx.feePayer = provider.publicKey;
    console.log("Start Tx");
    try {
        let signedTransaction = await provider.signTransaction(tx);
        console.log("Tx: ", tx);
        const serializedTransaction = signedTransaction.serialize();
        const signature = await connection.sendRawTransaction(
            serializedTransaction,
            { skipPreflight: false, preflightCommitment: 'confirmed' },
        );        
        console.log("Signature: ", signature);
        console.log(`https://solscan.io/tx/${signature}?cluster=mainnet`);    
    } catch(error) {
        console.log("Error: ", error)
        error = JSON.stringify(error);
        error = JSON.parse(error);
        console.log("Error Logs: ", error)
        return;
    }
}

async function ReadALT() {
    if (!wallet_initialized) {
        console.log("Error, wallet not initialized");
        return
    }
    console.log("Connected to wallet");
    console.log("Provider Pubkey: ", provider.publicKey.toString());

    let lookupTablePubkey = new solanaWeb3.PublicKey("ETunTW1EtRgZVuUGAhzjmzAWibsJ4h8CYQ13nMVirXtk");

	const lookupTableAccount = await connection
		.getAddressLookupTable(lookupTablePubkey)
		.then((res) => res.value);
	console.log(`Lookup Table: ${lookupTablePubkey}`);
	
    for (let i = 0; i < lookupTableAccount.state.addresses.length; i++) {
		const address = lookupTableAccount.state.addresses[i];
		console.log(`   Index: ${i}  Address: ${address.toBase58()}`);
	}
}

async function GetAssetsByOwner() { 
    if (!wallet_initialized) {
        console.log("Error, wallet not initialized");
        return
    }
    console.log("Connected to wallet");
    console.log("Provider Pubkey: ", provider.publicKey.toString());

    let heliusUrl = "https://devnet.helius-rpc.com/?api-key=HELIUS_KEY";
    let owner = new solanaWeb3.PublicKey("42iqZhSMk3zXUnAs1NbHEfepgs4YyemnBAt62Md2JVpY");
    
    const axiosInstance = axios.create({baseURL: heliusUrl,});
    let assets = await axiosInstance.post(heliusUrl, { 
        jsonrpc: "2.0", 
        method: "getAssetsByOwner", 
        id: "rpd-op-123",
        params: {
            ownerAddress: provider.publicKey.toString(), 
            page: 1,limit: 1000
        },
    });
    assets = assets.data.result;
    
    // filter for cnfts
    let cnfts = [];
    for (let i = 0; i < assets.items.length; i++) {
        let ass = assets.items[i];
        if(ass.compression.compressed===true) {
            cnfts.push(ass);
        }
    }
    console.log("cnfts ", cnfts);
}


// deactivate a helper alt
async function altDeactivate(_alt_,_helius_,_close_=false) {
  
  console.log("deactivate helper: "+_alt_);
  let connection = new solanaWeb3.Connection(_helius_, "confirmed");
  let alt_address = new solanaWeb3.PublicKey(_alt_);
  let deactiveALTIx = solanaWeb3.AddressLookupTableProgram.deactivateLookupTable({
  authority: provider.publicKey,lookupTable: alt_address,});
  
  let messageV0 = new solanaWeb3.TransactionMessage({
    payerKey: provider.publicKey,
    recentBlockhash: (await connection.getRecentBlockhash('confirmed')).blockhash,
    instructions: [deactiveALTIx],
  }).compileToV0Message([]);  
  
  let tx = new solanaWeb3.VersionedTransaction(messageV0);
  console.log("deactivating...", _alt_);
  
  try {
    let signature = null;
    let signedTx = null;
    if(keypair!=null){
      tx.sign([provider]);
      signature = await connection.sendTransaction(tx);
    }
    else{
      signedTx = await provider.signTransaction(tx);
      signature = await connection.sendTransaction(signedTx);
    }
    console.log("signature: ", signature);
    console.log("finalizing deactivation...", _alt_);
    let i = 0;
    const finalize_deactivation = setInterval(async function() {
      let tx_status = await connection.getSignatureStatuses([signature],{searchTransactionHistory:true})
      .catch(function(){});
      if (typeof tx_status == "undefined" || 
      typeof tx_status.value == "undefined" || 
      tx_status.value == null || 
      tx_status.value[0] == null || 
      typeof tx_status.value[0] == "undefined" || 
      typeof tx_status.value[0].confirmationStatus == "undefined") {
        
      } 
      else if(tx_status.value[0].confirmationStatus=="finalized") {
        clearInterval(finalize_deactivation);
        console.log("helper deactivated: ", _alt_);
        // check slots to close
        let cs = 0;
        if(_close_==false){
          console.log("waiting to close...", _alt_);
          const check_slots = setInterval(async function() {
          let closing = await altClose(_alt_,_helius_);
          if(closing=="ok"){
            clearInterval(check_slots);
            console.log("done");
          }
          else if(Number.isInteger(closing)){
            console.log("wait time: "+closing+" blocks...");
          }
          else{
            clearInterval(check_slots);
            console.log("...");
  //               console.log("there may have been a problem closing the alt");
  //               console.log("try running the following command to find out");
  //               console.log("npm run mcburn close "+_alt_);
          }
          cs++;
          if(cs==10){
            clearInterval(check_slots);
            console.log("exceeded retry limit! ", _alt_);
            console.log("done");
          }
        },60000);
        }
      }
      i++;
      if(i==20){
        clearInterval(finalize_deactivation);
        console.log("exceeded retry limit! ", _alt_);
        console.log("done");
      }
    }, 3000);
  } 
  catch(error) {
    console.log("error : ", _alt_);
    console.log("Error: ", error);
    error = JSON.stringify(error);
    error = JSON.parse(error);
    console.log("Error Logs: ", error);
    return;
  }
  
}

// close a helper alt and recover the rent
async function altClose(_alt_,_helius_) {
  let connection = new solanaWeb3.Connection(_helius_,"confirmed");
  let alt_address = new solanaWeb3.PublicKey(_alt_);
  let closeALTIx = solanaWeb3.AddressLookupTableProgram.closeLookupTable({
    authority: provider.publicKey,
    lookupTable: alt_address,
    recipient: provider.publicKey,
  });
  let messageV0 = new solanaWeb3.TransactionMessage({
    payerKey: provider.publicKey,
    recentBlockhash: (await connection.getRecentBlockhash('confirmed')).blockhash,
    instructions: [closeALTIx],
  }).compileToV0Message([]);  
  let tx = new solanaWeb3.VersionedTransaction(messageV0);
  console.log("attempting to close... ", _alt_);
  try {
    let signature = null;
    let signedTx = null;
    if(keypair!=null){
      tx.sign([provider]);
      signature = await connection.sendTransaction(tx);
    }
    else{
      signedTx = await provider.signTransaction(tx);
      signature = await connection.sendTransaction(signedTx);
    }
    console.log("signature: ", signature);
    console.log("finalizing rent recovery... ", _alt_);
    let i = 0;
    const finalize_recovery = setInterval(async function() {
      let tx_status = await connection.getSignatureStatuses([signature],{searchTransactionHistory:true})
      .catch(function(){});
      if (typeof tx_status == "undefined" || 
      typeof tx_status.value == "undefined" || 
      tx_status.value == null || 
      tx_status.value[0] == null || 
      typeof tx_status.value[0] == "undefined" || 
      typeof tx_status.value[0].confirmationStatus == "undefined") {
        
      } 
      else if(tx_status.value[0].confirmationStatus=="finalized") {
        clearInterval(finalize_recovery);
        console.log("alt closed: ", _alt_);
        console.log("funds recovered: ", _alt_);
        console.log("done");
        return "ok";
      }
      i++;
      if(i==30){
        clearInterval(finalize_recovery);
        console.log("exceeded retry limit! ", _alt_);
      }
    }, 3000);
  }
  catch(error) {
    for (let i = 0; i < error.logs.length; i++) {
      if(error.logs[i].includes("Table cannot be closed")){
        let str = error.logs[i];
        str = str.replace(/[^\d.]/g,'');
        str = parseInt(str);
        return str;
      }
    }
    console.log("error!");
    console.log(error);
    return;
  }
}

// returns the number of proofs required for a cNFT asset
async function proofsRequired(id) {
  if (id.length < 32) {
      return;
    }
    let connection = new solanaWeb3.Connection(conf.cluster, "confirmed");
    let axiosInstance = axios.create({
      baseURL: conf.cluster
    });
    let response = await axiosInstance.post(conf.cluster, {
      jsonrpc: "2.0",
      method: "getAssetProof",
      id: "rpd-op-123",
      params: {
        id: id
      },
    });
    if(typeof response.data.result.tree_id == "undefined"){
      let axiosInstance = axios.create({
        baseURL: conf.cluster
      });
      let response = await axiosInstance.post(conf.cluster, {
        jsonrpc: "2.0",
        method: "getAssetProof",
        id: "rpd-op-123",
        params: {
          id: id
        },
      });
    }
    if(typeof response.data.result.tree_id == "undefined"){
      return false;
    }
    else{
      let ck_treeId = response.data.result.tree_id;
      let ck_Proof = response.data.result.proof;
      let ck_Root = response.data.result.root;
      let ck_treeIdPubKey = new solanaWeb3.PublicKey(ck_treeId);
      let treeAccount = await splAccountCompression_.ConcurrentMerkleTreeAccount.fromAccountAddress(connection, ck_treeIdPubKey, );
      let treeAuthority = treeAccount.getAuthority();
      return (response.data.result.proof.length - treeAccount.getCanopyDepth());
    }
}


$('#thingButton').on('click', () => {
    console.log('Working ...');
    // InitializeSwap();
    SwapcNFTs();
    // ReverseSwap()
    // GetAssetsByOwner();
    // UpdateState();
    // CreateALT();
    // ExtendALT();
    // ReadALT();
});
$('#thingButton').prop('disabled', true);

$(window).on('load', async () => {
    await connectRPC();
});
