/**
 * for those errors we wanna show correct i18n text in frontend,
 * summary them here so we can track in assets/i18n/[local]/error.json
 *
 * This file will be used in both frontend and backend,
 * so be careful to import other modules here.
 */

type ErrorType = {
    i18n:string;
    data?:any;
};

export function unknownError(err:any) : ErrorType {
    return {
        i18n: 'unknownError',
        data: err && err.toString() || 'Can\'t get rpc error data',
    };
}

export function handleRPCError (err:string) : ErrorType {
    try {
        const error = JSON.parse(err);
        if (!error.i18n) { return unknownError(error); }
        return error;
    } catch (e) {
        return unknownError(err);
    }
}